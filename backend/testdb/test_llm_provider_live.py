"""Opt-in endpoint smoke test; synthetic context only, no credentials in output."""
import json
import os

import pytest
from rest_framework.test import APIClient


@pytest.mark.skipif(os.environ.get('MYGPT_LIVE_PROVIDER_TEST') != '1', reason='Live endpoint not requested')
@pytest.mark.parametrize('stream', [False, True])
@pytest.mark.parametrize('route', ['ollama_generate', 'ollama_chat'])
@pytest.mark.django_db
def test_live_provider_through_mygpt(route, stream):
    api = APIClient()
    model = os.environ['LLM_TEST_MODEL']
    discovery = api.post('/api/get_ollama_models/', {}, format='json')
    assert discovery.status_code == 200
    assert model in [m['name'] for m in discovery.json()['models']]
    system = 'Use only this context: The fictional test lighthouse is violet. Reply with only the color.'
    question = 'What color is the fictional test lighthouse?'
    body = {'model': model, 'stream': stream, 'options': {'temperature': 0, 'top_p': 1}}
    if route == 'ollama_generate':
        body.update(system=system, prompt=question)
    else:
        body.update(new_conversation=True, messages=[{'role': 'system', 'content': system},
                                                    {'role': 'user', 'content': question}])
    response = api.post(f'/api/{route}/', body, format='json')
    assert response.status_code == 200
    if stream:
        events = [json.loads(line) for line in response.streaming_content]
        assert not any(e.get('error') for e in events)
        assert events[-1].get('type') == 'done'
        text = ''.join(e.get('content', '') for e in events if e.get('type') == 'response')
    else:
        assert not response.json().get('error')
        text = response.json().get('response' if route == 'ollama_generate' else 'content', '')
    assert 'violet' in text.lower(), 'Response did not use the supplied context'
