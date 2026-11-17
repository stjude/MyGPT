# Nature paper validation

Verified locally on November 17, 2026 with Python 3.12 on Windows and a remote
Qwen Chat Completions endpoint. This is a small integration smoke test, not an
accuracy benchmark or evidence that the model cannot hallucinate.

## Document and configuration

- Jumper et al., [Highly accurate protein structure prediction with AlphaFold](https://www.nature.com/articles/s41586-021-03819-2), Nature (2021).
- [Open-access publisher PDF](https://www.nature.com/articles/s41586-021-03819-2.pdf): 12 pages.
- PDF SHA-256: `6eae057a9faf4f671c3101e0745ed704460c6d3dec77243dfd3a9f2d2ab68970`.
- Local embedding model: Chroma's ONNX `all-MiniLM-L6-v2`.
- 1,600-character chunks, 320-character overlap, cosine distance: **66 chunks**.
- Retrieve up to eight passages, with cutoff disabled; no BM25 or reranker.
- Generation: `qwen-3.8-27b-nvfp4`, temperature 0, 2,048 output-token limit,
  `chat_template_kwargs.enable_thinking=false`.

## Results

The test uses Django's API client against the actual upload, retrieval and
generation views. It creates an isolated database and redirects the existing
`/code` storage paths into a temporary directory. Extraction, embeddings, Chroma
search, PDF highlighting and outbound model requests are real; none are mocked.

| Check | Observed result |
| --- | --- |
| Full PDF upload and indexing | Passed; 12 pages, 66 indexed chunks |
| CASP14 median backbone accuracy | Correctly returned 0.96 angstrom for AlphaFold and 2.8 angstrom for the next method; supporting passage retrieved from PDF page 2 (journal page 584) |
| pLDDT meaning and target | Correctly described predicted local-distance difference test and prediction of lDDT-C-alpha accuracy; supporting passage retrieved from PDF page 2 |
| Unsupported question about the authors' pet dragon | Explicitly stated that the documents contain no such information |
| Source attribution | Every retrieved passage matched the text on its reported PDF page |
| PDF highlighting | Highlighted PDFs retained all 12 pages and contained highlight annotations |
| Streaming and non-streaming | All three questions passed in both modes |
| Provider profiles | The same six checks passed with `openai` and with `vllm`: 12 answer checks total |

The source facts on PDF page 2 were also visually reviewed. Generated answers were
manually reviewed, including additional pLDDT statistics against page 3. The
automated abstention check is phrase-based; it is not a general hallucination judge.

Both provider profiles used the **same Qwen endpoint**. This does not establish
that its serving engine is vLLM, nor validate OpenAI's hosted service. Source-page
checks verify MyGPT's retrieved evidence; they do not provide sentence-level
citations for every generated assertion. This run did not test the browser UI,
scanned PDFs, figure interpretation, scientific tables, or multi-paper synthesis.

## Repeat the test

Download the publisher PDF separately; it is not included in this repository.
Install the backend requirements plus pytest. `fonttools` is optional but avoids
pypdf font-decoding warnings for this PDF. Provide the endpoint and credentials
through environment variables as described in [model providers](model-providers.md).

From `backend` (POSIX shell example; use equivalent environment variables in PowerShell):

```sh
export PYTHONUTF8=1
export MYGPT_LIVE_PAPER_TEST=1
export MYGPT_TEST_PDF=/absolute/path/s41586-021-03819-2.pdf
export LLM_TEST_MODEL=your-served-model-id
export LLM_EXTRA_BODY='{"chat_template_kwargs":{"enable_thinking":false}}'
export MYGPT_PAPER_REPORT=/absolute/path/paper-report.json
python -m pytest testdb/test_nature_rag_live.py -v
```

Only set the extra Qwen template option if the chosen endpoint supports it.
`MYGPT_PAPER_REPORT` is optional and contains answers and page numbers, not keys.
The test pins the PDF hash to make the page assertions reproducible. Review a
changed publisher PDF before updating that pin. Normal CI skips both live tests.

Two existing Windows defects surfaced and were fixed: sanitizing an already-safe
absolute upload path corrupted the drive letter, and splitting attachment paths
only on `/` broke PDF highlighting. An offline storage regression test protects
the upload fix.
