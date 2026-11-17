"""Opt-in live checks using synthetic text only; no secrets in test output."""
import json
import os

import pytest
from rest_framework.test import APIClient


@pytest.mark.skipif(os.environ.get('MYGPT_LIVE_PROVIDER_TEST') != '1', reason='Live endpoint not requested')
@pytest.mark.django_db
def test_live_provider_through_mygpt():
    api = APIClient()
    models = api.post('/api/get_ollama_models/', {}, format='json')
    assert models.status_code == 200, 'Model discovery failed'
    model = os.environ['LLM_TEST_MODEL']
    assert model in [m['name'] for m in models.json()['models']], 'Configured test model not discovered'
    for stream in (False, True):
        response = api.post('/api/ollama_generate/', {
            'model': model, 'prompt': 'What color is the fictional test lighthouse?',
            'system': 'Use only this context: The fictional test lighthouse is violet. Reply with only the color.',
            'stream': stream, 'options': {'temperature': 0, 'top_p': 1},
        }, format='json')
        assert response.status_code == 200, 'Generation request failed'
        if stream:
            events = [json.loads(line) for line in response.streaming_content]
            assert not any(e.get('error') for e in events), 'Stream reported an error'
            assert events[-1].get('type') == 'done', 'Stream did not complete'
            text = ''.join(e.get('content', '') for e in events if e.get('type') == 'response')
        else:
            assert not response.json().get('error'), 'Generation reported an error'
            text = response.json().get('response', '')
        assert 'violet' in text.lower(), 'Response did not use the synthetic context'
    for stream in (False, True):
        response = api.post('/api/ollama_chat/', {'model': model, 'new_conversation': True,
            'messages': [{'role': 'user', 'content': 'Reply with exactly: provider test passed'}],
            'stream': stream}, format='json')
        assert response.status_code == 200, 'Chat request failed'
        if stream:
            events = [json.loads(line) for line in response.streaming_content]
            assert not any(e.get('error') for e in events), 'Chat stream failed'
            assert events[-1].get('type') == 'done'
            text = ''.join(e.get('content', '') for e in events if e.get('type') == 'response')
        else:
            text = response.json().get('content', '')
        assert 'provider test passed' in text.lower(), 'Chat did not return expected text'
