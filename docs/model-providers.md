# Generation providers

MyGPT can use Ollama (the default), an OpenAI Chat Completions-compatible server,
or vLLM. This applies to document-grounded generation, direct chat, model discovery,
streaming, and non-streaming tool calls. The browser uses MyGPT's existing backend
API; provider credentials and the upstream URL are configured only on the server.
There is no automatic fallback to a different provider.

## Configuration

Set these variables in the ignored `.env_backend` used by Docker Compose, or in
the backend process environment. Restart the backend after changing them.

```dotenv
LLM_PROVIDER=vllm
LLM_BASE_URL=http://model-server:8000/v1
LLM_API_KEY=
LLM_MAX_OUTPUT_TOKENS=2048
LLM_TIMEOUT_SECONDS=120
```

For a generic compatible server use `LLM_PROVIDER=openai`. The URL must include
the API prefix; MyGPT appends `/models` and `/chat/completions`. Model names such
as `Qwen/Qwen3-32B` are preserved exactly. An empty API key supports a trusted
internal server that does not require bearer authentication. Use HTTPS when
connecting across an untrusted network. Redirects are not followed.

For OpenAI's hosted Chat Completions API, use `https://api.openai.com/v1` and an
appropriate API key. This integration does not implement the Responses API.
If a model requires the newer token-limit parameter, set
`LLM_TOKEN_PARAMETER=max_completion_tokens`. For models that do not accept
sampling controls, set `LLM_SEND_SAMPLING=false`.

`temperature` and `top_p` are portable sampling fields. `top_k` is sent only for
the `vllm` provider. Ollama's `think` option is not forwarded. Optional server-side
`LLM_EXTRA_BODY` accepts only `reasoning_effort` and `chat_template_kwargs`, e.g.
`{"chat_template_kwargs":{"enable_thinking":false}}` for a compatible Qwen
template. These options are model/server-specific; leave them unset unless supported.
Reasoning returned as `reasoning_content` or `reasoning` is separated from answer text.

The model list comes from the configured backend provider, including in Electron.
Settings show the active provider and hide Ollama downloads for remote providers.
Manage vLLM's served models on the vLLM server. The legacy `LLM_server_API_specs`
frontend setting can remain `ollama`: that selects MyGPT's normalized transport,
not the backend inference engine. `openai` and `vllm` also select that transport.

## Scope and data handling

- Embeddings, rerankers, and ingestion are unchanged. A generation endpoint alone
  does not replace those services. Keep your existing embedding configuration.
- Document context and prompts are sent to the configured generation server.
  Use an approved local/internal endpoint when keeping data on your own infrastructure.
- Translation uses the selected generation model for remote providers; Ollama
  retains its existing `translategemma:latest` translation model.
- Tool calls use the existing non-streaming tool-selection step followed by a
  streamed or non-streamed answer. Tool-call IDs are retained in follow-up messages.
  Tool/vision support still depends on the selected model and server configuration.
- HTTP failures, malformed responses, truncated completions, and interrupted streams
  report failures instead of treating partial output as a completed answer.
- Output-token limits reserve generation capacity; they do not automatically trim
  a document context that exceeds the model's context window.

## Local validation

From `backend`, run `python -m pytest testdb`. The provider tests start a loopback
HTTP server and exercise real JSON/SSE requests, both provider modes, namespaced
models, credentials, tool calls, split UTF-8, failure handling, and Django endpoints.
From `frontend`, run `npm ci`, `npm test`, and `npm run build`.

To explicitly test your configured live endpoint with synthetic text only:

```sh
export MYGPT_LIVE_PROVIDER_TEST=1
export LLM_TEST_MODEL=your-served-model-id
python -m pytest testdb/test_llm_provider_live.py -v
```

Provide `LLM_PROVIDER`, `LLM_BASE_URL`, and `LLM_API_KEY` in the process environment.
The test creates a temporary test database, sends a short invented context, and
checks model listing, direct chat, and streamed/non-streamed context-grounded
generation through the actual Django API. It never uploads a document library.
Normal tests skip the live check, and no credential is stored in the repository.

For a real scientific PDF test, see [Nature paper validation](nature-paper-validation.md).
This additionally exercises upload, local embeddings, vector retrieval, PDF source
pages, highlighting, and grounded generation. It found and fixed two Windows path
handling defects in the existing document pipeline.
