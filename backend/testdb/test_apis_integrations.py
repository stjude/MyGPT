import json
from types import SimpleNamespace
from unittest.mock import patch

from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from testdb.models import Dataset, FrontEndSettings, Model


class APIValidationAndAccessTests(TestCase):
	@patch('testdb.views.apis.get_zotero_chunks')
	def test_zotero_endpoint_rejects_invalid_api_key_before_external_calls(self, get_zotero_chunks):
		response = APIClient().post(reverse('add_zotero_collection'), {'api_key': '<invalid>'})

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.json()['error_message'], 'Invalid API key')
		get_zotero_chunks.assert_not_called()

	@patch('testdb.views.apis.add_dataset_from_upload', return_value='Uploaded Library')
	def test_upload_rejects_invalid_embedding_model(self, add_dataset_from_upload):
		response = APIClient().post(reverse('upload_documents'), {
			'chunking_method': 'fixed_chunk_size',
			'use_bm25': 'No',
			'reranker': 'None',
			'documents_language': 'english',
			'embedding_model': '<invalid>',
			'distance_function': 'l2',
		})

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.json()['error_message'], 'Invalid embedding model name')
		add_dataset_from_upload.assert_called_once()

	def test_secure_media_requires_login_for_private_library_when_enabled(self):
		FrontEndSettings.objects.create(django_login=True)
		Dataset.objects.create(dataset_name='Private Library', user_email='owner@example.com')

		response = APIClient().get(reverse('secure_media', kwargs={'file_path': 'papers/Private_Library/paper.pdf'}))

		self.assertEqual(response.status_code, 401)

	def test_logout_requires_authentication(self):
		response = APIClient().post(reverse('logout'), {}, format='json')
		self.assertEqual(response.status_code, 401)

	@patch('testdb.views.apis.OllamaClient')
	def test_generate_rejects_invalid_model_name(self, ollama_client):
		response = APIClient().post(
			reverse('ollama_generate'),
			{'model': '../bad', 'prompt': 'hello'},
			format='json',
		)

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.json()['error_message'], 'Invalid model name')
		ollama_client.assert_not_called()

	@patch('testdb.views.apis.OllamaClient')
	def test_chat_rejects_invalid_model_name(self, ollama_client):
		response = APIClient().post(
			reverse('ollama_chat'),
			{'new_conversation': True, 'model': '../bad', 'messages': []},
			format='json',
		)

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.json()['error_message'], 'Invalid model name')
		ollama_client.assert_not_called()


class OllamaModelsAPITests(TestCase):
	@patch('testdb.views.apis.OllamaClient')
	def test_lists_models_and_registers_only_non_f16_models(self, ollama_client):
		Model.objects.create(model_name='existing-model:latest', model_size='2.00')
		ollama_client.return_value.list.return_value = SimpleNamespace(models=[
			SimpleNamespace(
				model='llama3:latest', size=1_500_000_000,
				details={'family': 'llama', 'format': 'gguf', 'parameter_size': '8B', 'quantization_level': 'Q4_K_M'},
			),
			SimpleNamespace(
				model='embedding:latest', size=500_000_000,
				details={'family': 'bert', 'format': 'gguf', 'parameter_size': '100M', 'quantization_level': 'F16'},
			),
			SimpleNamespace(
				model='existing-model:latest', size=2_000_000_000,
				details={'family': 'llama', 'format': 'gguf', 'parameter_size': '8B', 'quantization_level': 'Q4_K_M'},
			),
			SimpleNamespace(
				model='zero-size:latest', size=0,
				details={'family': 'llama', 'format': 'gguf', 'parameter_size': '8B', 'quantization_level': 'Q4_K_M'},
			),
		])

		response = APIClient().post(reverse('get_ollama_models'), {}, format='json')

		self.assertEqual(response.status_code, 200)
		self.assertEqual(
			[model['name'] for model in response.json()['models']],
			['llama3:latest', 'embedding:latest', 'existing-model:latest'],
		)
		self.assertEqual(response.json()['models'][0]['quantization_level'], 'Q4_K_M')
		self.assertEqual(Model.objects.count(), 2)
		self.assertEqual(Model.objects.get(model_name='llama3:latest').model_size, '1.50')
		ollama_client.return_value.list.assert_called_once_with()

	@patch('testdb.views.apis.OllamaClient')
	def test_returns_server_error_when_ollama_listing_fails(self, ollama_client):
		ollama_client.return_value.list.side_effect = RuntimeError('Ollama unavailable')
		with self.assertLogs('testdb.views.apis', level='ERROR') as captured_logs:
			response = APIClient().post(reverse('get_ollama_models'), {}, format='json')

		self.assertEqual(response.status_code, 500)
		self.assertEqual(response.json()['error_message'], 'Unable to list models')
		self.assertIn('Unable to list Ollama models', captured_logs.output[0])

	def test_rejects_get_requests(self):
		response = APIClient().get(reverse('get_ollama_models'))
		self.assertEqual(response.status_code, 405)

	def test_add_ollama_models_does_not_duplicate_or_overwrite_existing_models(self):
		Model.objects.create(model_name='existing-model:latest', model_size='2.00')
		response = APIClient().post(
			reverse('add_ollama_models'),
			{'llms': [
				{'name': 'existing-model:latest', 'size': '3.00'},
				{'name': 'new-model:latest', 'size': '1.50'},
			]},
			format='json',
		)

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.json(), {'added': True})
		self.assertEqual(Model.objects.count(), 2)
		self.assertEqual(Model.objects.get(model_name='existing-model:latest').model_size, '2.00')
		self.assertEqual(Model.objects.get(model_name='new-model:latest').model_size, '1.50')

	@patch('testdb.views.apis.OllamaClient')
	def test_rejects_invalid_model_names_without_contacting_ollama(self, ollama_client):
		for model_name in ('', '../../etc/passwd'):
			with self.subTest(model_name=model_name):
				response = APIClient().post(reverse('ollama_pull_model'), {'name': model_name}, format='json')
				self.assertTrue(response.json()['error'])
				self.assertEqual(response.json()['error_message'], 'Invalid model name')
		ollama_client.assert_not_called()

	@patch('testdb.views.apis.OllamaClient')
	def test_streams_model_pull_progress_and_completion(self, ollama_client):
		ollama_client.return_value.pull.return_value = iter([
			{'status': 'downloading', 'digest': 'sha256:layer', 'total': 100, 'completed': 25},
			{'status': 'downloading', 'digest': 'sha256:layer', 'total': 100, 'completed': 100},
		])
		response = APIClient().post(reverse('ollama_pull_model'), {'name': 'llama3:latest'}, format='json')
		lines = [json.loads(line) for line in response.streaming_content]

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response['Content-Type'], 'application/x-ndjson')
		self.assertEqual([line['percent'] for line in lines if line.get('type') == 'progress'], [25.0, 100.0])
		self.assertTrue(lines[-1]['done'])