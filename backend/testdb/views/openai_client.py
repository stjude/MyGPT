import json
import os
from collections.abc import Iterator
from typing import Any

import httpx


DEFAULT_OPENAI_MODEL = 'gpt-6-luna'


def is_openai_model(model: str) -> bool:
    return model == DEFAULT_OPENAI_MODEL or model.startswith('openai:')


class OpenAIResponseError(ValueError):
    pass


class OpenAIResponsesClient:
    """Translate Responses API results into the existing generation/chat contract."""

    def __init__(self) -> None:
        self._api_key = os.environ.get('OPENAI_API_KEY', '').strip()
        if not self._api_key:
            raise OpenAIResponseError('Configure OPENAI_API_KEY in .env_backend to use OpenAI models.')

    def generate(self, *, model: str, prompt: str, system: str = '', stream: bool = True,
                 think: bool = False, options: dict | None = None):
        payload = self._payload(model, [{'role': 'user', 'content': prompt}], stream)
        if system:
            payload['instructions'] = system
        if stream:
            return self._stream(payload, chat=False)
        message = self._complete(payload)
        if message['tool_calls']:
            raise OpenAIResponseError('OpenAI returned unexpected tool calls for a text request.')
        return {'response': message['content'], 'thinking': ''}

    def chat(self, *, model: str, messages: list[dict], stream: bool = True,
             think: bool = False, options: dict | None = None, tools: list[dict] | None = None):
        items = []
        for message in messages:
            role = message['role']
            if role == 'tool':
                call_id = message.get('tool_call_id')
                if not call_id:
                    raise OpenAIResponseError('OpenAI tool replies require a tool_call_id.')
                items.append({
                    'type': 'function_call_output', 'call_id': call_id,
                    'output': message['content'],
                })
            else:
                if message.get('openai_output'):
                    items.extend(message['openai_output'])
                    continue
                if message.get('content'):
                    items.append({'role': role, 'content': message['content']})
                for call in message.get('tool_calls') or []:
                    function = call['function']
                    arguments = function['arguments']
                    items.append({
                        'type': 'function_call', 'call_id': call['id'],
                        'name': function['name'],
                        'arguments': arguments if isinstance(arguments, str) else json.dumps(arguments),
                    })
        payload = self._payload(model, items, stream)
        if tools:
            payload['tools'] = [
                {'type': 'function', **tool['function'], 'strict': False} for tool in tools
            ]
        if stream:
            return self._stream(payload, chat=True)
        return {'message': self._complete(payload)}

    @staticmethod
    def _payload(model: str, items: list[dict], stream: bool) -> dict[str, Any]:
        name = model.removeprefix('openai:')
        if not name:
            raise OpenAIResponseError('An OpenAI model name is required.')
        # Ollama sampling and think options are not portable to reasoning models.
        return {
            'model': name, 'input': items, 'stream': stream, 'store': False,
            'include': ['reasoning.encrypted_content'],
        }

    def _client(self) -> httpx.Client:
        return httpx.Client(
            base_url='https://api.openai.com/v1/',
            headers={'Authorization': 'Bearer ' + self._api_key},
            timeout=httpx.Timeout(120.0, connect=15.0),
        )

    @staticmethod
    def _check_status(response: httpx.Response) -> None:
        if response.is_error:
            raise OpenAIResponseError(
                f'OpenAI request failed (HTTP {response.status_code}). '
                'Check the API key, model access, billing, and input limits.'
            )
        response.raise_for_status()

    @staticmethod
    def _message(response: dict) -> dict:
        if response.get('status') != 'completed':
            raise OpenAIResponseError('OpenAI did not complete the response. Check model and output limits.')
        text = []
        calls = []
        for item in response.get('output', []):
            if item.get('type') == 'message':
                for content in item.get('content', []):
                    if content.get('type') == 'refusal':
                        raise OpenAIResponseError('OpenAI declined this request.')
                    if content.get('type') == 'output_text':
                        text.append(content['text'])
            elif item.get('type') == 'function_call':
                calls.append({
                    'id': item['call_id'], 'type': 'function',
                    'function': {'name': item['name'], 'arguments': item['arguments']},
                })
        if not ''.join(text) and not calls:
            raise OpenAIResponseError('OpenAI returned no answer.')
        return {
            'content': ''.join(text), 'thinking': '', 'tool_calls': calls,
            'openai_output': response.get('output', []),
        }

    def _complete(self, payload: dict) -> dict:
        with self._client() as client:
            response = client.post('responses', json=payload)
            self._check_status(response)
            return self._message(response.json())

    def _stream(self, payload: dict, *, chat: bool) -> Iterator[dict]:
        with self._client() as client, client.stream('POST', 'responses', json=payload) as response:
            self._check_status(response)
            completed = False
            emitted_text = False
            for event in self._events(response):
                event_type = event.get('type')
                if event_type == 'response.output_text.delta':
                    delta = event['delta']
                    emitted_text = emitted_text or bool(delta)
                    yield {'message': {'content': delta}} if chat else {'response': delta}
                elif event_type == 'response.completed':
                    message = self._message(event['response'])
                    if message['tool_calls']:
                        raise OpenAIResponseError('Use non-streaming mode for OpenAI tool calls.')
                    if not emitted_text:
                        yield {'message': {'content': message['content']}} if chat else {'response': message['content']}
                    completed = True
                elif event_type in ('error', 'response.failed', 'response.incomplete'):
                    raise OpenAIResponseError('OpenAI generation failed or was incomplete.')
                elif event_type == 'response.refusal.delta':
                    raise OpenAIResponseError('OpenAI declined this request.')
            if not completed:
                raise OpenAIResponseError('OpenAI stream ended before completion.')

    @staticmethod
    def _events(response: httpx.Response) -> Iterator[dict]:
        data = []
        for line in response.iter_lines():
            if line.startswith('data:'):
                data.append(line[5:].lstrip())
            elif not line and data:
                payload = '\n'.join(data)
                data = []
                if payload != '[DONE]':
                    yield json.loads(payload)
        if data and '\n'.join(data) != '[DONE]':
            yield json.loads('\n'.join(data))
