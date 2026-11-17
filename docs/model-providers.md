# Model providers

MyGPT supports Ollama (default), OpenAI Chat Completions-compatible endpoints,
and vLLM for generation, direct chat, model discovery, and streaming. Configure
the backend process or ignored `.env_backend` file and restart it:

```dotenv
LLM_PROVIDER=vllm
LLM_BASE_URL=http://model-server:8000/v1
LLM_API_KEY=
LLM_MAX_OUTPUT_TOKENS=2048
LLM_TIMEOUT_SECONDS=120
```

Use `LLM_PROVIDER=openai` for other compatible servers. For OpenAI's hosted API,
set `LLM_BASE_URL=https://api.openai.com/v1` and supply your API key. The URL must
include the API prefix: MyGPT appends `/models` and `/chat/completions`. Model IDs
such as `Qwen/Qwen3-32B` are supported. An empty key permits unauthenticated local
servers; use HTTPS for remote servers. Credentials stay on the backend.

Optional model-specific settings:

| Variable | Default | Purpose |
| --- | --- | --- |
| `LLM_TOKEN_PARAMETER` | `max_tokens` | Set to `max_completion_tokens` when required by the model |
| `LLM_SEND_SAMPLING` | `true` | Set to `false` for models that reject sampling controls |
| `LLM_EXTRA_BODY` | `{}` | Only `reasoning_effort` and `chat_template_kwargs` are accepted; for compatible Qwen templates, `{"chat_template_kwargs":{"enable_thinking":false}}` disables reasoning |

`temperature` and `top_p` are forwarded; `top_k` is vLLM-only. Ollama's `think`
field is not forwarded. Returned reasoning is separated from answer text.
Settings hide Ollama downloads for remote providers. The legacy frontend
`LLM_server_API_specs` setting may remain `ollama`; the backend selects the provider.
Remote translation uses the selected model instead of `translategemma:latest`.

Embeddings and rerankers retain their existing configuration. Document context is
sent to the chosen generation server. This integration does not add the Responses
API, provider fallback, or automatic context trimming. Tool/vision support depends
on the model; existing non-streaming tool selection preserves tool-call IDs.

## Tests

Run `python -m pytest testdb` from `backend`, and `npm test` / `npm run build` from
`frontend`. Tests cover both profiles, JSON/SSE, namespaced IDs, tool calls,
UTF-8 boundaries, and errors without exposing upstream credentials or prompts.
To test a live server, set the provider variables above, `LLM_TEST_MODEL` to a
served model, and `MYGPT_LIVE_PROVIDER_TEST=1`, then run
`python -m pytest testdb/test_llm_provider_live.py -v`. This opt-in test uses
synthetic text and a temporary database; it is skipped in ordinary CI.
