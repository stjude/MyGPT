"""Exercise real HTTP/SSE transport locally; no external models or credentials needed."""
import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from types import SimpleNamespace

import pytest
from rest_framework.test import APIClient

from testdb.llm_providers import OpenAICompatibleClient, ProviderError, direct_chat_dataset, valid_model_name


@pytest.fixture
def endpoint(monkeypatch):
    state = SimpleNamespace(requests=[], status=200, stream=None, completion=None)

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def do_GET(self):
            state.requests.append((self.path, dict(self.headers), None))
            self.send_response(state.status)
            self.end_headers()
            self.wfile.write(json.dumps({'data': [{'id': 'Qwen/Test-Model'}, {'id': '../bad'}]}).encode())

        def do_POST(self):
            body = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
            state.requests.append((self.path, dict(self.headers), body))
            self.send_response(state.status)
            self.send_header('Content-Type', 'text/event-stream' if body.get('stream') else 'application/json')
            self.end_headers()
            if state.status != 200:
                self.wfile.write(b'{"error":"private upstream error and credential"}')
            elif body.get('stream'):
                wire = state.stream or (
                    ': heartbeat\n\ndata: {"choices":[{"delta":{"reasoning_content":"checking"}}]}\n\n'
                    'data: {"choices":[{"delta":{"content":"Hello café"}}]}\n\n'
                    'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n'
                    'data: {"choices":[],"usage":{"total_tokens":9}}\n\ndata: [DONE]\n\n')
                for offset in range(0, len(wire.encode()), 7):
                    self.wfile.write(wire.encode()[offset:offset + 7])
                    self.wfile.flush()
            else:
                self.wfile.write(json.dumps(state.completion or {
                    'choices': [{'message': {'content': 'Hello café', 'reasoning_content': 'checking'},
                                 'finish_reason': 'stop'}]}).encode())

    server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    monkeypatch.setenv('LLM_PROVIDER', 'openai')
    monkeypatch.setenv('LLM_BASE_URL', f'http://127.0.0.1:{server.server_port}/v1/')
    monkeypatch.setenv('LLM_API_KEY', 'test-only-not-a-real-key')
    monkeypatch.setenv('LLM_MAX_OUTPUT_TOKENS', '128')
    monkeypatch.delenv('LLM_EXTRA_BODY', raising=False)
    monkeypatch.delenv('LLM_TOKEN_PARAMETER', raising=False)
    monkeypatch.delenv('LLM_SEND_SAMPLING', raising=False)
    yield state
    server.shutdown()
    server.server_close()
    thread.join()


@pytest.mark.parametrize('provider', ['openai', 'vllm'])
def test_discovery_generation_and_fragmented_stream(endpoint, monkeypatch, provider):
    monkeypatch.setenv('LLM_PROVIDER', provider)
    client = OpenAICompatibleClient()
    assert client.list_models() == ['Qwen/Test-Model']
    kwargs = dict(model='Qwen/Test-Model', prompt='hello', system='Use supplied evidence',
                  options={'temperature': .2, 'top_p': .8, 'top_k': 20}, think=True)
    assert client.generate(**kwargs)['response'] == 'Hello café'
    parts = list(client.generate(**kwargs, stream=True))
    assert ''.join(part['response'] for part in parts) == 'Hello café'
    assert ''.join(part['thinking'] for part in parts) == 'checking'
    path, headers, payload = endpoint.requests[-1]
    assert path == '/v1/chat/completions'
    assert headers['Authorization'] == 'Bearer test-only-not-a-real-key'
    assert payload['messages'][0] == {'role': 'system', 'content': 'Use supplied evidence'}
    assert payload['max_tokens'] == 128
    assert ('top_k' in payload) == (provider == 'vllm')
    assert 'think' not in payload


def test_reasoning_model_configuration_and_no_auth_local_server(endpoint, monkeypatch):
    monkeypatch.setenv('LLM_TOKEN_PARAMETER', 'max_completion_tokens')
    monkeypatch.setenv('LLM_SEND_SAMPLING', 'false')
    monkeypatch.setenv('LLM_EXTRA_BODY', '{"reasoning_effort":"low"}')
    monkeypatch.delenv('LLM_API_KEY')
    OpenAICompatibleClient().generate(model='model', prompt='test', options={'temperature': .2})
    _, headers, body = endpoint.requests[-1]
    assert 'Authorization' not in headers
    assert body['max_completion_tokens'] == 128
    assert body['reasoning_effort'] == 'low'
    assert 'temperature' not in body and 'max_tokens' not in body


@pytest.mark.parametrize('status', [302, 401, 429, 500])
def test_upstream_errors_are_sanitized_and_redirects_not_followed(endpoint, status):
    endpoint.status = status
    with pytest.raises(ProviderError, match=f'HTTP {status}') as caught:
        OpenAICompatibleClient().generate(model='model', prompt='private prompt')
    assert 'credential' not in str(caught.value) and 'private' not in str(caught.value)
    assert len(endpoint.requests) == 1


@pytest.mark.parametrize('wire', [
    'data: {"error":{"message":"secret upstream detail"}}\n\n',
    'data: not-json\n\n',
    'data: {"choices":[{"delta":{"content":"partial"}}]}\n\n',
    'data: {"choices":[{"delta":{},"finish_reason":"length"}]}\n\n',
    'data: [DONE]\n\n',
])
def test_stream_failure_never_reports_success(endpoint, wire):
    endpoint.stream = wire
    with pytest.raises(ProviderError):
        list(OpenAICompatibleClient().generate(model='model', prompt='test', stream=True))


def test_tool_calls_preserve_id_and_json_arguments(endpoint):
    call = {'id': 'call_1', 'type': 'function',
            'function': {'name': 'lookup', 'arguments': '{"id":42}'}}
    endpoint.completion = {'choices': [{'message': {'content': None, 'tool_calls': [call]},
                                        'finish_reason': 'tool_calls'}]}
    client = OpenAICompatibleClient()
    response = client.chat(model='model', messages=[{'role': 'user', 'content': 'lookup'}],
                           tools=[{'type': 'function', 'function': {'name': 'lookup'}}])
    assert response['message']['tool_calls'] == [call]


@pytest.mark.parametrize('model', ['', '../bad', '/bad', 'a/../b', 'a//b', 'a\nb', 'x' * 181])
def test_rejects_unsafe_model_ids(model):
    assert not valid_model_name(model)


def test_namespaced_models_do_not_become_paths_or_collide():
    assert valid_model_name('Qwen/Qwen3-32B')
    assert '/' not in direct_chat_dataset('Qwen/Qwen3-32B')
    assert direct_chat_dataset('a/b') != direct_chat_dataset('a_b')
    assert direct_chat_dataset('llama3:latest') == 'llama3:latest_direct_chat'


@pytest.mark.django_db
def test_mygpt_http_endpoints_use_adapter_for_rag_and_direct_chat(endpoint):
    api = APIClient()
    models = api.post('/api/get_ollama_models/', {}, format='json')
    assert models.status_code == 200
    assert models.json()['models'][0]['name'] == 'Qwen/Test-Model'
    assert models.json()['models'][0]['direct_chat_dataset'] == direct_chat_dataset('Qwen/Test-Model')
    assert models.json()['supports_pull'] is False
    config = api.get('/api/llm_provider/').json()
    assert config == {'provider': 'openai', 'supports_pull': False}
    assert api.post('/api/ollama_pull_model/', {'name': 'model'}, format='json').status_code == 400
    generation = {'model': 'Qwen/Test-Model', 'prompt': 'Answer from context: café', 'stream': False}
    assert api.post('/api/ollama_generate/', generation, format='json').json()['response'] == 'Hello café'
    generation['stream'] = True
    response = api.post('/api/ollama_generate/', generation, format='json')
    events = [json.loads(line) for line in response.streaming_content]
    assert events[-1]['type'] == 'done'
    assert any(event['content'] == 'Hello café' for event in events)
    chat = {'model': 'Qwen/Test-Model', 'messages': [{'role': 'user', 'content': 'hello'}], 'stream': False}
    assert api.post('/api/ollama_chat/', chat, format='json').json()['content'] == 'Hello café'
    chat['stream'] = True
    response = api.post('/api/ollama_chat/', chat, format='json')
    assert json.loads(list(response.streaming_content)[-1])['type'] == 'done'


@pytest.mark.django_db
def test_stream_error_reaches_ui_without_false_done(endpoint):
    endpoint.stream = 'data: {"error":{"message":"private upstream detail"}}\n\n'
    response = APIClient().post('/api/ollama_generate/', {'model': 'model', 'prompt': 'hi'}, format='json')
    events = [json.loads(line) for line in response.streaming_content]
    assert events[-1]['error'] is True
    assert not any(event.get('type') == 'done' for event in events)
    assert 'private upstream detail' not in json.dumps(events)
