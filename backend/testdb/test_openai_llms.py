import json
import os
from unittest.mock import patch

import httpx
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from testdb.models import Model, Question
from testdb.views.openai_client import OpenAIResponsesClient, OpenAIResponseError, is_openai_model


def completed(text='An answer'):
    return {'status': 'completed', 'output': [
        {'type': 'reasoning', 'id': 'reasoning_1', 'encrypted_content': 'opaque'},
        {'type': 'message', 'role': 'assistant', 'content': [{'type': 'output_text', 'text': text}]},
    ]}


class OpenAILLMTests(TestCase):
    def setUp(self):
        self.addCleanup(patch.stopall)
        patch.dict(os.environ, {'OPENAI_API_KEY': 'test-only-key'}).start()
        self.requests = []
        self.status = 200
        self.payload = completed()
        self.events = None
        client_factory = httpx.Client

        def handle_request(request):
            self.requests.append(request)
            if self.events is not None:
                body = ''.join('event: ignored\ndata: ' + json.dumps(event) + '\n\n' for event in self.events)
                return httpx.Response(self.status, text=body, headers={'Content-Type': 'text/event-stream'})
            return httpx.Response(self.status, json=self.payload)

        def create_client(**kwargs):
            return client_factory(transport=httpx.MockTransport(handle_request), **kwargs)

        patch('testdb.views.openai_client.httpx.Client', side_effect=create_client).start()
        self.ollama = patch('testdb.views.apis.OllamaClient').start()

    def generate(self, **kwargs):
        return APIClient().post(reverse('ollama_generate'), {
            'model': 'gpt-6-luna', 'prompt': 'Question', 'system': 'Use this context',
            'stream': False, **kwargs,
        }, format='json')

    def chat(self, **kwargs):
        return APIClient().post(reverse('ollama_chat'), {
            'model': 'gpt-6-luna', 'new_conversation': True,
            'messages': [
                {'role': 'system', 'content': 'Be helpful'},
                {'role': 'user', 'content': 'First question'},
                {'role': 'assistant', 'content': 'First answer'},
                {'role': 'user', 'content': 'Follow-up'},
            ],
            'stream': False, **kwargs,
        }, format='json')

    def test_generate_uses_responses_api_and_preserves_contract(self):
        response = self.generate(options={'temperature': 0.4, 'top_k': 50, 'top_p': 0.9}, think=True)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'response': 'An answer', 'thinking': ''})
        request = self.requests[0]
        self.assertEqual(str(request.url), 'https://api.openai.com/v1/responses')
        self.assertEqual(request.headers['authorization'], 'Bearer test-only-key')
        payload = json.loads(request.content)
        self.assertEqual(payload['model'], 'gpt-6-luna')
        self.assertEqual(payload['input'], [{'role': 'user', 'content': 'Question'}])
        self.assertEqual(payload['instructions'], 'Use this context')
        self.assertFalse(payload['store'])
        self.assertNotIn('options', payload)
        self.assertNotIn('temperature', payload)
        self.assertNotIn('think', payload)
        self.ollama.assert_not_called()

    def test_stream_translates_deltas_and_only_marks_completed_response_done(self):
        self.events = [
            {'type': 'response.created'},
            {'type': 'response.output_text.delta', 'delta': 'An '},
            {'type': 'response.output_text.delta', 'delta': 'answer'},
            {'type': 'response.completed', 'response': completed()},
        ]
        response = self.generate(stream=True)
        events = [json.loads(line) for line in response.streaming_content]
        self.assertEqual(events, [
            {'type': 'response', 'content': 'An ', 'done': False},
            {'type': 'response', 'content': 'answer', 'done': False},
            {'type': 'done', 'content': '', 'done': True},
        ])
        self.assertTrue(json.loads(self.requests[0].content)['stream'])

    def test_chat_preserves_history_and_saves_question(self):
        response = self.chat()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['content'], 'An answer')
        self.assertEqual(response.json()['tool_calls'], [])
        self.assertEqual(len(json.loads(self.requests[0].content)['input']), 4)
        self.assertTrue(Question.objects.filter(
            question_text='Follow-up', model_type__model_name='gpt-6-luna',
        ).exists())
        self.ollama.assert_not_called()

    def test_chat_stream(self):
        self.events = [
            {'type': 'response.output_text.delta', 'delta': 'An answer'},
            {'type': 'response.completed', 'response': completed()},
        ]
        response = self.chat(stream=True)
        events = [json.loads(line) for line in response.streaming_content]
        self.assertEqual(events[0]['content'], 'An answer')
        self.assertEqual(events[-1]['type'], 'done')

    def test_tool_definitions_and_results_round_trip(self):
        self.payload = {'status': 'completed', 'output': [
            {'type': 'reasoning', 'id': 'reasoning_1', 'encrypted_content': 'opaque'},
            {'type': 'function_call', 'name': 'lookup', 'arguments': '{"term":"GPCR"}', 'call_id': 'call_1'},
        ]}
        tools = [{'type': 'function', 'function': {
            'name': 'lookup', 'description': 'Look up a term',
            'parameters': {'type': 'object', 'properties': {'term': {'type': 'string'}}},
        }}]
        response = self.chat(tools=tools).json()
        self.assertEqual(response['tool_calls'][0]['id'], 'call_1')
        self.assertEqual(json.loads(self.requests[0].content)['tools'][0]['name'], 'lookup')
        self.payload = completed('Tool answer')
        follow_up = self.chat(new_conversation=False, messages=[
            {'role': 'user', 'content': 'Find GPCR'},
            {'role': 'assistant', 'content': '', 'openai_output': response['openai_output']},
            {'role': 'tool', 'tool_call_id': 'call_1', 'content': 'Found GPCR'},
        ])
        self.assertEqual(follow_up.json()['content'], 'Tool answer')
        items = json.loads(self.requests[-1].content)['input']
        self.assertEqual(items[1]['type'], 'reasoning')
        self.assertEqual(items[2]['call_id'], 'call_1')
        self.assertEqual(items[3], {
            'type': 'function_call_output', 'call_id': 'call_1', 'output': 'Found GPCR',
        })

    def test_missing_key_returns_actionable_error_without_calling_provider(self):
        with patch.dict(os.environ, {'OPENAI_API_KEY': ''}):
            for endpoint in (self.generate, self.chat):
                with self.subTest(endpoint=endpoint.__name__), self.assertLogs('testdb.views.apis', level='ERROR'):
                    response = endpoint()
                    self.assertEqual(response.status_code, 400)
                    self.assertIn('OPENAI_API_KEY', response.json()['error_message'])
        self.assertEqual(self.requests, [])
        self.ollama.assert_not_called()

    def test_http_errors_do_not_become_answers(self):
        for status in (401, 404, 429, 500):
            with self.subTest(status=status), self.assertLogs('testdb.views.apis', level='ERROR'):
                self.status = status
                response = self.generate()
                self.assertEqual(response.status_code, 502)
                self.assertTrue(response.json()['error'])
                self.assertIn(str(status), response.json()['error_message'])

    def test_failed_or_truncated_stream_never_yields_success(self):
        for events in (
            [{'type': 'response.output_text.delta', 'delta': 'partial'}],
            [{'type': 'response.failed'}], [{'type': 'response.incomplete'}],
            [{'type': 'error'}], [{'type': 'response.refusal.delta'}],
        ):
            with self.subTest(events=events), self.assertLogs('testdb.views.apis', level='ERROR'):
                self.events = events
                response = self.generate(stream=True)
                data = [json.loads(line) for line in response.streaming_content]
                self.assertTrue(data[-1]['error'])
                self.assertFalse(any(event.get('type') == 'done' for event in data))

    def test_empty_incomplete_and_refusal_responses_raise(self):
        for payload in (
            {'status': 'incomplete', 'output': []},
            {'status': 'completed', 'output': []},
            {'status': 'completed', 'output': [
                {'type': 'message', 'content': [{'type': 'refusal', 'refusal': 'No'}]},
            ]},
        ):
            with self.subTest(payload=payload):
                self.payload = payload
                with self.assertRaises(OpenAIResponseError):
                    OpenAIResponsesClient().generate(model='gpt-6-luna', prompt='q', stream=False)

    def test_prefixed_models_and_ollama_gpt_oss_are_distinguished(self):
        self.assertFalse(is_openai_model('gpt-oss:20b'))
        self.assertTrue(is_openai_model('openai:gpt-custom'))
        response = self.generate(model='openai:gpt-custom')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(json.loads(self.requests[0].content)['model'], 'gpt-custom')
        self.ollama.return_value.generate.return_value = {'response': 'Local', 'thinking': ''}
        response = self.generate(model='gpt-oss:20b')
        self.assertEqual(response.json()['response'], 'Local')
        self.ollama.assert_called_once()

    def test_context_registers_openai_model_without_ollama_discovery(self):
        response = APIClient().post(reverse('get_context'), {
            'text': 'Question', 'model_type': 'gpt-6-luna', 'dataset': 'ignored',
            'use_default_qrs': False, 'question_best_distance': 0,
            'question_worst_distance': 1, 'maximum_chunks_count': 5,
            'no_cutoff': True, 'no_context': True,
        }, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(Model.objects.filter(model_name='gpt-6-luna').exists())
        self.assertEqual(response.json()['sources'], [])
