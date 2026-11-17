"""Opt-in real PDF -> local embeddings -> retrieval -> live generation check.

The caller supplies the open-access Nature AlphaFold PDF; no paper or credentials
are committed. Only storage paths are redirected for an isolated Windows/Linux
test. PDF extraction, ONNX embeddings, Chroma search and HTTP generation are real.
"""
import hashlib
import json
import os
from pathlib import Path
import re

import chromadb
import pymupdf
import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from testdb.models import Dataset, EmbeddingModel, Papers
from testdb.views import vector_db
from testdb.views.document_processing import getPDFContent


@pytest.mark.skipif(os.environ.get('MYGPT_LIVE_PAPER_TEST') != '1', reason='Live paper test not requested')
@pytest.mark.django_db
def test_nature_pdf_through_mygpt(tmp_path, monkeypatch, settings):
    pdf_path = Path(os.environ['MYGPT_TEST_PDF']).resolve()
    pdf_bytes = pdf_path.read_bytes()
    # Pin the version used for page and fact assertions, rather than accepting an
    # arbitrary PDF and mistakenly reporting that Nature evidence was verified.
    sha256 = hashlib.sha256(pdf_bytes).hexdigest()
    assert sha256 == '6eae057a9faf4f671c3101e0745ed704460c6d3dec77243dfd3a9f2d2ab68970'
    pages = [re.sub(r'\s+', ' ', p.extract_text()).strip() for p in getPDFContent(str(pdf_path))]
    assert len(pages) == 12
    monkeypatch.chdir(tmp_path)
    settings.MEDIA_ROOT = str(tmp_path / 'media')
    (tmp_path / 'data/data_chunks').mkdir(parents=True)
    original_client = chromadb.PersistentClient
    monkeypatch.setattr(chromadb, 'PersistentClient', lambda *args, **kwargs:
                        original_client(path=str(tmp_path / 'chroma_storage')))
    original_open = open
    code_root = os.path.abspath('/code')

    def storage_open(path, *args, **kwargs):
        relative = os.path.relpath(path, code_root)
        assert not relative.startswith('..'), 'Unexpected storage path'
        return original_open(tmp_path / relative, *args, **kwargs)

    monkeypatch.setattr(vector_db, 'open', storage_open, raising=False)
    # Calibration is not part of this test: explicitly retain the top 8 passages.
    # Pre-register the real local embedder to avoid the separate cutoff CSV job.
    EmbeddingModel.objects.create(model_name='all-MiniLM-L6-v2', model_source='sentence-transformer')
    api = APIClient()
    model = os.environ['LLM_TEST_MODEL']
    discovery = api.post('/api/get_ollama_models/', {}, format='json')
    assert discovery.status_code == 200
    assert model in [m['name'] for m in discovery.json()['models']]
    upload = api.post('/api/upload_documents/', {
        'dataset_name': 'nature_alphafold_validation',
        'paper_title': 'Highly accurate protein structure prediction with AlphaFold',
        'paper_attachment': SimpleUploadedFile('alphafold.pdf', pdf_bytes, content_type='application/pdf'),
        'user': 'validation', 'user_email': 'validation@example.com', 'user_group': 'validation',
        'use_overlap': 'Yes', 'chunking_method': 'fixed_chunk_size', 'chunk_size': '1600',
        'distance_function': 'cosine', 'use_bm25': 'No', 'reranker': 'None',
        'documents_language': 'english', 'embedding_model': 'all-MiniLM-L6-v2',
    }, format='multipart')
    assert upload.status_code == 200 and upload.json().get('uploaded'), 'Native PDF upload/indexing failed'
    dataset = Dataset.objects.get(dataset_name='nature_alphafold_validation')
    assert dataset.dataset_size > 20
    cases = [
        ('What median backbone accuracy did AlphaFold achieve in CASP14, and what did the next best method achieve?',
         ['0.96', '2.8'], '0.96'),
        ('What does pLDDT stand for, and what accuracy does it predict?',
         ['local', 'distance', 'difference'], 'pLDDT'),
        ('What is the name of the authors\' pet dragon?', [], None),
    ]
    report = {'doi': '10.1038/s41586-021-03819-2', 'pdf_sha256': sha256,
              'pages': len(pages), 'indexed_chunks': dataset.dataset_size,
              'provider': os.environ['LLM_PROVIDER'], 'model': model, 'checks': []}
    for question, expected, evidence in cases:
        retrieved = api.post('/api/get_context/', {
            'text': question, 'model_type': model, 'dataset': dataset.dataset_name,
            'use_default_qrs': False, 'question_best_distance': 0, 'question_worst_distance': 2,
            'maximum_chunks_count': 8, 'no_cutoff': True, 'skip_highlight': False,
        }, format='json')
        assert retrieved.status_code == 200
        result = retrieved.json()
        sources = result['sources']
        assert sources, 'Retrieval returned no passages'
        paper = Papers.objects.get(paper_dataset=dataset)
        with pymupdf.open(paper.highlighted_attachment.path) as highlighted:
            assert len(highlighted) == len(pages)
            assert any(list(page.annots()) for page in highlighted), 'No PDF evidence highlights produced'
        # Check every returned passage really belongs to its advertised PDF page.
        for source in sources:
            assert source['context'] in pages[int(source['page']) - 1], 'Incorrect source page'
        if evidence:
            assert any(s['page'] == 2 and evidence in s['context'] for s in sources), 'Expected evidence not retrieved'
        for stream in (False, True):
            response = api.post('/api/ollama_generate/', {
                'model': model, 'prompt': question,
                'system': dataset.dataset_prompt + '\n' + result['context'],
                'stream': stream, 'options': {'temperature': 0, 'top_p': 1},
            }, format='json')
            assert response.status_code == 200
            if stream:
                events = [json.loads(line) for line in response.streaming_content]
                assert not any(e.get('error') for e in events), 'Generation stream failed'
                assert events[-1].get('type') == 'done'
                answer = ''.join(e.get('content', '') for e in events if e.get('type') == 'response')
            else:
                assert not response.json().get('error'), 'Generation failed'
                answer = response.json()['response']
            report['checks'].append({'question': question, 'stream': stream, 'answer': answer,
                                     'source_pages': sorted({s['page'] for s in sources}),
                                     'source_page_verification': 'passed'})
            if os.environ.get('MYGPT_PAPER_REPORT'):
                Path(os.environ['MYGPT_PAPER_REPORT']).write_text(json.dumps(report, indent=2), encoding='utf-8')
            if expected:
                assert all(term in answer.lower() for term in expected), 'Expected fact missing from answer'
            else:
                assert any(term in answer.lower() for term in ['not found', 'not mentioned', 'not provided',
                                                              'does not', 'do not', "doesn't", 'no information']), f'Failed to abstain: {answer}'
