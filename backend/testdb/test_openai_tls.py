import os
import ssl
import tempfile
from unittest.mock import patch

import certifi
import httpx
from django.test import SimpleTestCase

from testdb.views.embedding_functions import OpenAIEmbeddingFunction
from testdb.views.openai_client import (
    OpenAIResponseError, OpenAIResponsesClient, openai_tls_verification,
)


class OpenAITLSTests(SimpleTestCase):
    def test_unconfigured_ca_preserves_httpx_default_verification(self):
        with patch.dict(os.environ, {'OPENAI_CA_BUNDLE': ''}):
            self.assertIs(openai_tls_verification(), True)

    def test_additional_ca_is_loaded_with_hostname_and_certificate_verification_enabled(self):
        context = ssl.create_default_context(cafile=certifi.where())
        with patch.dict(os.environ, {'OPENAI_CA_BUNDLE': certifi.where()}):
            with patch('testdb.views.openai_client.ssl.create_default_context', return_value=context):
                with patch.object(context, 'load_verify_locations', wraps=context.load_verify_locations) as load:
                    result = openai_tls_verification()
        load.assert_called_once_with(cafile=certifi.where())
        self.assertIs(result, context)
        self.assertTrue(context.check_hostname)
        self.assertEqual(context.verify_mode, ssl.CERT_REQUIRED)
        self.assertGreater(context.cert_store_stats()['x509_ca'], 0)

    def test_explicit_httpx_trust_settings_are_preserved(self):
        with patch.dict(os.environ, {
            'OPENAI_CA_BUNDLE': certifi.where(), 'SSL_CERT_FILE': certifi.where(),
            'SSL_CERT_DIR': '/example/certificates',
        }):
            with patch('testdb.views.openai_client.ssl.create_default_context') as create:
                openai_tls_verification()
        create.assert_called_once_with(cafile=certifi.where(), capath='/example/certificates')
        create.return_value.load_verify_locations.assert_called_once_with(cafile=certifi.where())

    def test_missing_and_invalid_ca_files_fail_without_insecure_fallback(self):
        with tempfile.TemporaryDirectory() as directory:
            invalid = os.path.join(directory, 'invalid.pem')
            with open(invalid, 'w') as file:
                file.write('not a certificate')
            for path in (invalid, os.path.join(directory, 'missing.pem')):
                with self.subTest(path=path), patch.dict(os.environ, {'OPENAI_CA_BUNDLE': path}):
                    with self.assertRaisesRegex(OpenAIResponseError, 'Unable to load OPENAI_CA_BUNDLE'):
                        openai_tls_verification()

    def test_both_clients_receive_verified_context_and_never_serialize_ca_path(self):
        with patch.dict(os.environ, {
            'OPENAI_API_KEY': 'test-only-key', 'OPENAI_CA_BUNDLE': certifi.where(),
        }):
            with patch('testdb.views.openai_client.httpx.Client') as client:
                OpenAIResponsesClient()._client()
                embedding = OpenAIEmbeddingFunction()
        self.assertEqual(client.call_count, 2)
        for call in client.call_args_list:
            context = call.kwargs['verify']
            self.assertIsInstance(context, ssl.SSLContext)
            self.assertTrue(context.check_hostname)
            self.assertEqual(context.verify_mode, ssl.CERT_REQUIRED)
        self.assertEqual(embedding.get_config(), {'model_name': 'text-embedding-3-small'})

    def test_embedding_certificate_failure_has_same_actionable_message(self):
        with patch.dict(os.environ, {'OPENAI_API_KEY': 'test-only-key', 'OPENAI_CA_BUNDLE': ''}):
            with patch('testdb.views.embedding_functions.httpx.Client') as client:
                client.return_value.post.side_effect = httpx.ConnectError('CERTIFICATE_VERIFY_FAILED')
                function = OpenAIEmbeddingFunction()
                with self.assertRaisesRegex(OpenAIResponseError, 'OPENAI_CA_BUNDLE'):
                    function(['example text'])
