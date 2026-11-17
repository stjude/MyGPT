"""Server-side Chat Completions adapter; keep credentials out of browser settings."""
import hashlib
import json
import os
import re
from urllib.parse import urlsplit

import requests


class ProviderError(RuntimeError):
    """Safe to log: never includes upstream bodies, prompts, URLs, or credentials."""


def provider_name():
    name = os.environ.get('LLM_PROVIDER', 'ollama').strip().lower()
    if name not in ('ollama', 'openai', 'vllm'):
        raise ProviderError('LLM_PROVIDER must be ollama, openai, or vllm')
    return name


def valid_model_name(model):
    return (isinstance(model, str) and 0 < len(model) <= 180
            and re.fullmatch(r'[A-Za-z0-9_][A-Za-z0-9_.:/-]*', model) is not None
            and all(part not in ('', '.', '..') for part in model.split('/')))


def direct_chat_dataset(model):
    # Hugging Face/vLLM IDs contain slashes; never use them as filesystem paths.
    if '/' in model:
        digest = hashlib.sha256(model.encode()).hexdigest()[:12]
        return re.sub(r'[^A-Za-z0-9_-]', '_', model)[:150] + '_' + digest + '_direct_chat'
    return model + '_direct_chat'


class OpenAICompatibleClient:
    """Translate Chat Completions JSON/SSE to MyGPT's existing Ollama-shaped contract."""

    def __init__(self):
        self.provider = provider_name()
        self.base_url = os.environ.get('LLM_BASE_URL', '').strip().rstrip('/')
        parsed = urlsplit(self.base_url)
        if (parsed.scheme not in ('http', 'https') or not parsed.hostname
                or parsed.username or parsed.password or parsed.query or parsed.fragment):
            raise ProviderError('Set LLM_BASE_URL to an HTTP(S) API base URL ending in /v1')
        self.headers = {'Accept': 'application/json', 'Content-Type': 'application/json'}
        key = os.environ.get('LLM_API_KEY', '').strip()
        if key:
            self.headers['Authorization'] = 'Bearer ' + key
        try:
            self.timeout = float(os.environ.get('LLM_TIMEOUT_SECONDS', '120'))
            self.max_tokens = int(os.environ.get('LLM_MAX_OUTPUT_TOKENS', '2048'))
        except ValueError:
            raise ProviderError('Invalid LLM timeout or output-token limit') from None
        if not 0 < self.timeout <= 1800 or not 0 < self.max_tokens <= 131072:
            raise ProviderError('LLM timeout or output-token limit is out of range')
        self.token_parameter = os.environ.get('LLM_TOKEN_PARAMETER', 'max_tokens')
        if self.token_parameter not in ('max_tokens', 'max_completion_tokens'):
            raise ProviderError('Invalid LLM_TOKEN_PARAMETER')

    def _request(self, method, path, **kwargs):
        try:
            response = requests.request(method, self.base_url + path, headers=self.headers,
                                        timeout=(10, self.timeout), allow_redirects=False, **kwargs)
        except requests.RequestException:
            raise ProviderError('Model endpoint connection failed or timed out') from None
        if not 200 <= response.status_code < 300:
            status = response.status_code
            response.close()
            raise ProviderError(f'Model endpoint returned HTTP {status}')
        response.encoding = 'utf-8'
        return response

    def list_models(self):
        with self._request('GET', '/models') as response:
            try:
                data = response.json()['data']
                if not isinstance(data, list):
                    raise ValueError()
                return [item['id'] for item in data
                        if isinstance(item, dict) and valid_model_name(item.get('id'))]
            except (ValueError, KeyError, TypeError):
                raise ProviderError('Model endpoint returned an invalid model list') from None

    def _payload(self, model, messages, stream, options, tools):
        if not valid_model_name(model):
            raise ProviderError('Invalid model name')
        if not isinstance(messages, list) or not all(isinstance(m, dict) for m in messages):
            raise ProviderError('Messages must be a list of message objects')
        normalized = []
        for original in messages:
            message = {k: v for k, v in original.items()
                       if k in ('role', 'content', 'name', 'tool_calls', 'tool_call_id')}
            if original.get('images'):
                content = message.get('content') or ''
                parts = [{'type': 'text', 'text': content}] if isinstance(content, str) else list(content)
                for image in original['images']:
                    parts.append({'type': 'image_url', 'image_url': {
                        'url': image if image.startswith('data:') else 'data:image/jpeg;base64,' + image}})
                message['content'] = parts
            normalized.append(message)
        payload = {'model': model, 'messages': normalized, 'stream': stream,
                   self.token_parameter: self.max_tokens}
        # top_k is a vLLM extension, not an OpenAI Chat Completions field.
        if os.environ.get('LLM_SEND_SAMPLING', 'true').lower() == 'true':
            for name in ('temperature', 'top_p'):
                if name in options:
                    payload[name] = options[name]
            if self.provider == 'vllm' and 'top_k' in options:
                payload['top_k'] = options['top_k']
        if tools:
            payload['tools'] = tools
        # Ollama's `think` is not portable. Only send explicitly configured server options.
        extra = os.environ.get('LLM_EXTRA_BODY', '{}')
        try:
            extra = json.loads(extra)
        except ValueError:
            raise ProviderError('LLM_EXTRA_BODY must be a JSON object') from None
        if not isinstance(extra, dict) or set(extra) - {'chat_template_kwargs', 'reasoning_effort'}:
            raise ProviderError('LLM_EXTRA_BODY supports chat_template_kwargs and reasoning_effort only')
        payload.update(extra)
        return payload

    @staticmethod
    def _message(message):
        if not isinstance(message, dict):
            raise ProviderError('Model endpoint returned an invalid message')
        return {'content': message.get('content') or '',
                'thinking': message.get('reasoning_content') or message.get('reasoning') or '',
                'tool_calls': message.get('tool_calls') or []}

    def chat(self, *, model, messages, stream=False, options=None, tools=None, think=None):
        payload = self._payload(model, messages, stream, options or {}, tools)
        if stream:
            return self._stream(payload)
        with self._request('POST', '/chat/completions', json=payload) as response:
            try:
                choice = response.json()['choices'][0]
                if choice.get('finish_reason') in ('length', 'content_filter'):
                    raise ProviderError('Model response was truncated or filtered')
                message = self._message(choice['message'])
                if not message['content'] and not message['tool_calls']:
                    raise ProviderError('Model endpoint returned no answer')
                return {'message': message}
            except (ValueError, KeyError, TypeError, IndexError):
                raise ProviderError('Model endpoint returned an invalid completion') from None

    def _stream(self, payload):
        try:
            with self._request('POST', '/chat/completions', json=payload, stream=True) as response:
                event = []
                finished = False
                received_answer = False
                # iter_lines handles arbitrary network boundaries, including split UTF-8.
                for line in response.iter_lines(decode_unicode=True):
                    if line.startswith('data:'):
                        event.append(line[5:].lstrip())
                    elif not line and event:
                        data = '\n'.join(event)
                        event = []
                        if data == '[DONE]':
                            if not finished or not received_answer:
                                raise ProviderError('Model stream ended without a complete answer')
                            return
                        try:
                            chunk = json.loads(data)
                            if 'error' in chunk:
                                raise ProviderError('Model endpoint reported a streaming error')
                            choices = chunk.get('choices', [])
                            if not choices:  # Usage-only events have no choices.
                                continue
                            choice = choices[0]
                            reason = choice.get('finish_reason')
                            if reason in ('length', 'content_filter'):
                                raise ProviderError('Model response was truncated or filtered')
                            finished = finished or reason is not None
                            message = self._message(choice.get('delta', {}))
                            received_answer = received_answer or bool(message['content'] or message['tool_calls'])
                            yield {'message': message}
                        except (ValueError, KeyError, TypeError, IndexError):
                            raise ProviderError('Model endpoint returned an invalid stream') from None
                if event or not finished or not received_answer:
                    raise ProviderError('Model stream ended before completion')
        except requests.RequestException:
            raise ProviderError('Model stream connection failed or timed out') from None

    def generate(self, *, model, prompt, system='', stream=False, options=None, think=None):
        messages = ([{'role': 'system', 'content': system}] if system else [])
        messages.append({'role': 'user', 'content': prompt})
        result = self.chat(model=model, messages=messages, stream=stream, options=options, think=think)
        if stream:
            return ({'response': part['message']['content'], 'thinking': part['message']['thinking']}
                    for part in result)
        return {'response': result['message']['content'], 'thinking': result['message']['thinking']}
