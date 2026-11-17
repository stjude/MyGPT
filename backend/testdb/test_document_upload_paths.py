"""Storage regression: an already-validated absolute path must stay intact."""
import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import RequestFactory

from testdb.models import Papers
from testdb.views import dataset_management


@pytest.mark.django_db
def test_pdf_upload_preserves_absolute_storage_path(tmp_path, monkeypatch, settings):
    monkeypatch.chdir(tmp_path)
    settings.MEDIA_ROOT = str(tmp_path / 'media')
    (tmp_path / 'data/data_chunks').mkdir(parents=True)
    # This regression checks file storage, not PDF parsing or embedding. The
    # opt-in Nature test covers those real operations with an actual paper.
    monkeypatch.setattr(dataset_management, 'getPDFContent', lambda path: [])
    request = RequestFactory().post('/api/upload_documents/', {
        'dataset_name': 'upload_path_test', 'paper_title': 'Path test',
        'paper_attachment': SimpleUploadedFile('paper.pdf', b'%PDF-storage-fixture'),
        'user': 'test', 'user_email': 'test@example.com', 'user_group': 'test',
        'use_overlap': 'Yes', 'chunking_method': 'fixed_chunk_size', 'chunk_size': '1000',
        'distance_function': 'cosine', 'use_bm25': 'No', 'reranker': 'None',
        'documents_language': 'english', 'embedding_model': 'all-MiniLM-L6-v2',
    })
    assert dataset_management.add_dataset_from_upload(request) == 'upload_path_test'
    assert (tmp_path / 'data/pdfs/upload_path_test/paper1.pdf').read_bytes() == b'%PDF-storage-fixture'
    paper = Papers.objects.get(paper_title='Path test')
    with paper.paper_attachment.open('rb') as uploaded:
        assert uploaded.read() == b'%PDF-storage-fixture'
