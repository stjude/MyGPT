import json
import os
from unittest.mock import patch

import chromadb
import httpx
import numpy as np
import pandas as pd
from chromadb.config import Settings
from chromadb.api.collection_configuration import collection_configuration_to_json
from django.test import SimpleTestCase, TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from testdb.models import EmbeddingModel
from testdb.views.embedding_functions import OpenAIEmbeddingFunction, OPENAI_EMBEDDING_MODELS
from testdb.views.embedding_utils import get_embedding_model_ef
from testdb.views.apis import _register_embedding_model


class OpenAIEmbeddingFunctionTests(SimpleTestCase):
    def setUp(self):
        self.addCleanup(patch.stopall)
        patch.dict(os.environ, {'OPENAI_API_KEY': 'test-only-key'}).start()
        self.requests = []
        self.status = 200
        self.payload = {'data': [{'index': 0, 'embedding': [0.25, 0.75]}]}
        client_factory = httpx.Client

        def handle_request(request):
            self.requests.append(request)
            payload = self.payload
            if payload is None:
                payload = {'data': [
                    {'index': i, 'embedding': [0.25, 0.75]}
                    for i, _ in enumerate(json.loads(request.content)['input'])
                ]}
            return httpx.Response(
                self.status, content=json.dumps(payload), headers={'Content-Type': 'application/json'},
            )

        def create_client(**kwargs):
            client = client_factory(transport=httpx.MockTransport(handle_request), **kwargs)
            self.addCleanup(client.close)
            return client

        patch('testdb.views.embedding_functions.httpx.Client', side_effect=create_client).start()

    def test_posts_model_and_text_and_orders_response_by_index(self):
        self.payload = {'data': [
            {'index': 1, 'embedding': [0.3, 0.4]},
            {'index': 0, 'embedding': [0.1, 0.2]},
        ]}
        embeddings = OpenAIEmbeddingFunction()(['first', 'second'])

        np.testing.assert_allclose(embeddings, [[0.1, 0.2], [0.3, 0.4]])
        request = self.requests[0]
        self.assertEqual(str(request.url), 'https://api.openai.com/v1/embeddings')
        self.assertEqual(request.headers['authorization'], 'Bearer test-only-key')
        self.assertEqual(json.loads(request.content), {
            'model': 'text-embedding-3-small',
            'input': ['first', 'second'],
            'encoding_format': 'float',
        })

    def test_batches_inputs_and_preserves_vector_count(self):
        self.payload = None
        function = OpenAIEmbeddingFunction('text-embedding-3-large')
        embeddings = function(['text'] * 101)

        self.assertEqual(len(embeddings), 101)
        self.assertEqual(len(self.requests), 2)
        self.assertEqual([len(json.loads(request.content)['input']) for request in self.requests], [100, 1])
        self.assertTrue(all(json.loads(request.content)['model'] == 'text-embedding-3-large'
                            for request in self.requests))

    def test_requires_backend_key(self):
        for key in ('', '   '):
            with self.subTest(key=key), patch.dict(os.environ, {'OPENAI_API_KEY': key}):
                with self.assertRaisesRegex(ValueError, 'OPENAI_API_KEY'):
                    OpenAIEmbeddingFunction()
        self.assertEqual(self.requests, [])

    def test_rejects_empty_text_before_request(self):
        function = OpenAIEmbeddingFunction()
        for texts in ([], [''], ['   '], ['valid', '']):
            with self.subTest(texts=texts), self.assertRaisesRegex(ValueError, 'non-empty'):
                function(texts)
        self.assertEqual(self.requests, [])

    def test_provider_errors_are_propagated(self):
        for status in (401, 429, 500):
            with self.subTest(status=status):
                self.status = status
                with self.assertRaises(httpx.HTTPStatusError):
                    OpenAIEmbeddingFunction()(['text'])

    def test_rejects_missing_or_malformed_vectors(self):
        for payload in (
            [], {}, {'data': []},
            {'data': [{'index': 1, 'embedding': [0.1]}]},
            {'data': [{'index': False, 'embedding': [0.1]}]},
            {'data': [{'index': 0, 'embedding': []}]},
            {'data': [{'index': 0, 'embedding': ['invalid']}]},
            {'data': [{'index': 0, 'embedding': [True]}]},
            {'data': [{'index': 0, 'embedding': [float('nan')]}]},
            {'data': [{'index': 0, 'embedding': [float('inf')]}]},
        ):
            with self.subTest(payload=payload):
                self.payload = payload
                with self.assertRaises(ValueError):
                    OpenAIEmbeddingFunction()(['text'])

    def test_rejects_duplicate_indices_and_inconsistent_dimensions(self):
        for data in (
            [{'index': 0, 'embedding': [0.1]}, {'index': 0, 'embedding': [0.2]}],
            [{'index': 0, 'embedding': [0.1]}, {'index': 1, 'embedding': [0.2, 0.3]}],
        ):
            with self.subTest(data=data):
                self.payload = {'data': data}
                with self.assertRaises(ValueError):
                    OpenAIEmbeddingFunction()(['first', 'second'])

    def test_chroma_indexes_queries_and_reloads_config_without_storing_key(self):
        client = chromadb.EphemeralClient(Settings(anonymized_telemetry=False))
        function = OpenAIEmbeddingFunction()
        collection = client.create_collection('test-openai-embedding', embedding_function=function)
        self.addCleanup(client.delete_collection, 'test-openai-embedding')
        collection.add(ids=['1'], documents=['document'])
        result = client.get_collection('test-openai-embedding').query(query_texts=['question'], n_results=1)

        self.assertEqual(result['ids'], [['1']])
        self.assertEqual(len(self.requests), 2)
        self.assertEqual(function.get_config(), {'model_name': 'text-embedding-3-small'})
        config = collection_configuration_to_json(collection.configuration)
        self.assertEqual(config['embedding_function']['config'], function.get_config())
        self.assertNotIn('test-only-key', json.dumps(config))


class OpenAIEmbeddingRoutingTests(TestCase):
    @patch.dict(os.environ, {'OPENAI_API_KEY': '', 'OLLAMA_SERVER': 'http://ollama:11434'})
    @patch('testdb.views.embedding_utils.OpenAIEmbeddingFunction')
    def test_existing_local_and_huggingface_routes_do_not_require_openai(self, openai_function):
        for model, source, adapter in (
            ('all-MiniLM-L6-v2', 'sentence-transformer', 'embedding_functions.DefaultEmbeddingFunction'),
            ('all-mpnet-base-v2', 'sentence-transformer', 'embedding_functions.SentenceTransformerEmbeddingFunction'),
            ('nomic-embed-text:latest', 'ollama', 'OllamaEmbeddingFunction'),
            ('sentence-transformers/example', 'huggingface', 'HuggingFaceEmbeddingFunction'),
        ):
            with self.subTest(model=model), patch('testdb.views.embedding_utils.' + adapter) as function:
                EmbeddingModel.objects.create(model_name=model, model_source=source)
                self.assertIs(get_embedding_model_ef(model), function.return_value)
                function.assert_called_once()
        openai_function.assert_not_called()

    @patch('testdb.views.embedding_utils.get_embedding_cutoff_distance', return_value=(0.2, 0.3, 0.4))
    @patch('testdb.views.embedding_utils.pd.read_csv')
    @patch('testdb.views.embedding_utils.OpenAIEmbeddingFunction')
    def test_new_standard_models_use_openai_and_calibrate(self, function, read_csv, cutoff):
        read_csv.return_value = pd.DataFrame([
            {'distance_tag': tag, 'question': 'q', 'answer': 'a',
             'answer_without_context': 'na', 'context_chunks': 'c1;c2'}
            for tag in ('best_q', 'worst_q', 'worst_a')
        ])
        for model in OPENAI_EMBEDDING_MODELS:
            with self.subTest(model=model):
                self.assertIs(get_embedding_model_ef(model), function.return_value)
                function.assert_called_with(model_name=model)
                record = EmbeddingModel.objects.get(model_name=model)
                self.assertEqual(record.model_source, 'openai')
                self.assertEqual(record.best_distance_q, 0.2)
                self.assertEqual(record.worst_distance_ac, 0.3)
                self.assertEqual(record.best_distance_nac, 0.4)
        self.assertEqual(cutoff.call_count, 9)

    @patch('testdb.views.embedding_utils.OpenAIEmbeddingFunction')
    @patch('testdb.views.embedding_utils.get_embedding_cutoff_distance')
    def test_existing_custom_openai_model_is_reused_without_recalibration(self, cutoff, function):
        EmbeddingModel.objects.create(model_name='custom-embedding', model_source='openai')
        self.assertIs(get_embedding_model_ef('custom-embedding'), function.return_value)
        function.assert_called_once_with(model_name='custom-embedding')
        cutoff.assert_not_called()

    @patch.dict(os.environ, {'OPENAI_API_KEY': ''})
    def test_missing_key_does_not_leave_uncalibrated_model_record(self):
        with self.assertRaisesRegex(ValueError, 'OPENAI_API_KEY'):
            get_embedding_model_ef('text-embedding-3-small')
        self.assertFalse(EmbeddingModel.objects.exists())

    @patch('testdb.views.embedding_utils.OpenAIEmbeddingFunction')
    @patch('testdb.views.embedding_utils.pd.read_csv')
    @patch('testdb.views.embedding_utils.get_embedding_cutoff_distance', side_effect=ValueError('provider failed'))
    def test_failed_calibration_rolls_back_new_model(self, cutoff, read_csv, function):
        read_csv.return_value = pd.DataFrame([{
            'distance_tag': 'best_q', 'question': 'q', 'answer': 'a',
            'answer_without_context': 'na', 'context_chunks': 'c',
        }])
        with self.assertRaisesRegex(ValueError, 'provider failed'):
            get_embedding_model_ef('text-embedding-3-small')
        self.assertFalse(EmbeddingModel.objects.exists())

    @patch('testdb.views.apis.get_embedding_model_ef')
    def test_registration_endpoint_preserves_source_and_calibrates_once(self, function):
        body = {'embedding_models': [
            {'name': 'custom-embedding', 'size': '-', 'source': 'openai'},
        ]}
        for _ in range(2):
            response = APIClient().post(reverse('add_embedding_models'), body, format='json')
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json(), {'added': True})
        self.assertEqual(EmbeddingModel.objects.get().model_source, 'openai')
        function.assert_called_once_with('custom-embedding', True)

    @patch('testdb.views.apis.get_embedding_model_ef', side_effect=ValueError('calibration failed'))
    def test_failed_registration_rolls_back_for_retry(self, function):
        with self.assertRaisesRegex(ValueError, 'calibration failed'):
            _register_embedding_model('custom-embedding', '-', 'openai')
        self.assertFalse(EmbeddingModel.objects.exists())
