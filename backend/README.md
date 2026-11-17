# MyGPT Backend

The backend is a Django and Django REST Framework application. It serves the MyGPT API, stores datasets and conversation records in PostgreSQL, and connects to OpenAI, Ollama, and the vector database for retrieval and model operations.

## Requirements

- Docker Desktop with Docker Compose
- A repository-root `.env_backend` file, created from `.env_backend.example`
- A repository-root `.env_frontend` file for the full application Compose setup
- An OpenAI API key for the default `gpt-6-luna` LLM, or an accessible Ollama server for local LLMs. Local Ollama embedding models still require Ollama even when answer generation uses OpenAI.

Create the ignored environment files from the repository root if they do not already exist:

```bash
cp .env_backend.example .env_backend
cp .env_frontend.example .env_frontend
```

Set secure database and Django values in `.env_backend`. Do not commit either environment file, and do not put secrets in `.env_frontend`; `VITE_` values are exposed to browser clients.

Set `OLLAMA_SERVER` in `.env_backend` to the server URL reachable from the
backend container, for example `OLLAMA_SERVER=https://your-ollama-server.example.org`.
The backend uses this URL for model listing, generation, and embeddings; a
frontend URL setting does not override it. The root Compose configuration reads
this value from `.env_backend`. After changing it, apply the new value with
`docker compose up -d --no-deps --force-recreate backend`; a container restart
alone does not reload environment files.

## Configure backend secrets

After copying `.env_backend.example`, open the repository-root `.env_backend` in a text editor and replace the placeholders:

- **`SECRET_KEY`** is a Django signing secret, not an API token. Generate it locally rather than using a third-party key-generation website. With Python 3 installed, run this on macOS or Linux:

  ```bash
  python3 -c "import secrets; print(secrets.token_urlsafe(50))"
  ```

  On Windows, run:

  ```cmd
  py -3 -c "import secrets; print(secrets.token_urlsafe(50))"
  ```

  Copy the output into `SECRET_KEY=<generated-key>`. Use a unique key for each deployment, keep it private, and retain it across container restarts.

- **`HUGGINGFACE_API_KEY`** is a Hugging Face user access token. Sign in at [Hugging Face access tokens](https://huggingface.co/settings/tokens), select **New token**, and give it a name such as `MyGPT`. A **Read** token is sufficient for downloading models your account can access. For hosted embedding inference, create a **Fine-grained** token with **Make calls to Inference Providers** permission, as required by the [feature-extraction API](https://huggingface.co/docs/inference-providers/tasks/feature-extraction). Grant model read access only where needed; repository write permission is not needed. Copy the token into `HUGGINGFACE_API_KEY=<your-token>`. For gated models, your account must also obtain access on the model's page. This token is used for Hugging Face embeddings, not local Ollama models.

Keep both values only in `.env_backend`, never in `.env_frontend`, screenshots, or shared messages. Also replace the default `POSTGRES_PASSWORD` with a strong, unique database password before deploying. Save the file before starting containers; if containers are already running, recreate them to apply changed environment values.

## OpenAI embeddings (optional)

OpenAI embeddings can be used with either OpenAI or Ollama answer generation. This setup is the same on macOS, Windows, Linux, and server deployments.

1. Create a secret key at [OpenAI API keys](https://platform.openai.com/api-keys). Enable API billing and grant permission to create embeddings. A ChatGPT subscription does not include API usage.
2. Set `OPENAI_API_KEY=<your-key>` in the root `.env_backend` file (see `.env_backend.example`). Leave it blank only if both your LLM and embeddings are local. Never put this key in `.env_frontend`, a `VITE_` variable, or source control.
3. Build the updated backend and frontend, then recreate the containers to load the code and environment changes:

   ```bash
   docker compose up -d --build backend frontend
   ```

4. In **Upload Documents > Advanced**, select `text-embedding-3-small` (1536 dimensions), `text-embedding-3-large` (3072 dimensions), or `text-embedding-ada-002` (1536 dimensions) in the **Embedding Model** node, then upload the new library. These models are also available when adding a Zotero library. No Ollama download is needed. The backend automatically registers and calibrates the model on first use; this can take longer than subsequent requests.

**Privacy and cost:** Selecting an OpenAI embedding model sends document chunks, retrieval questions, answer text used for scoring, and initial calibration examples to `https://api.openai.com/v1/embeddings`. These are paid API calls and require outbound HTTPS access. Only use this option with data approved for that service. Configure chunk sizes within the selected model's token limits; provider authentication, quota, and input-limit errors are not replaced with local embeddings.

Create a new library and upload its documents to change embedding models. Existing vectors cannot be mixed with vectors from another model, even when their dimensions match. Existing local-library embeddings and the default Ollama model are unchanged. Custom OpenAI embedding model names can also be registered through `api/add_embedding_models/` with `source: "openai"`; cutoff calibration uses the existing backend pipeline rather than fixed guessed values.

## OpenAI LLMs

The default LLM is **`gpt-6-luna`**. The backend calls the OpenAI **Responses API** at `https://api.openai.com/v1/responses`, using the same backend-only `OPENAI_API_KEY` as embeddings. No additional Python package or Ollama LLM download is needed.

1. Create a key at [OpenAI API keys](https://platform.openai.com/api-keys), enable API billing, and allow Responses API access. Your project must have access to the selected model; the configured model name does not guarantee availability.
2. Set `OPENAI_API_KEY=<your-key>` in the root `.env_backend`.
3. Set `VITE_DEFAULT_LLM=gpt-6-luna` in the root `.env_frontend`, especially if an existing file overrides the default.
4. Rebuild and recreate the backend and frontend with `docker compose up -d --build backend frontend`. Existing browser settings are retained; select `gpt-6-luna` in the model picker if you previously selected another model.

Direct chat, library-grounded generation, no-context comparison answers, translation, and MCP function-call follow-ups use the selected OpenAI LLM. Streaming is translated into the same newline-delimited events used by the UI. Ollama models remain selectable, including `gpt-oss:20b`, which is **not** routed to OpenAI. Cloud models remain listed when Ollama discovery is unavailable; using local embeddings still requires their local provider.

The existing endpoint names remain compatible: `api/ollama_generate/` and `api/ollama_chat/` automatically route `gpt-6-luna` to OpenAI. API clients can use another OpenAI model with the explicit `openai:` prefix, for example `"model": "openai:your-model-id"`; this prefix is stripped before contacting OpenAI. Generation accepts `prompt` and `system`; chat accepts `messages` and `new_conversation`. Both support `stream: false` as well as streaming.

Ollama-specific `top_k`, `top_p`, `temperature`, and `think` settings are not forwarded to OpenAI, because model support differs. Internal reasoning text is not exposed as UI thinking output. API errors, refusals, and incomplete streams are reported explicitly and are not saved as successful answers or retried with another provider.

**Privacy and cost:** OpenAI LLM use sends prompts, selected document context, chat history, and any tool results to OpenAI. Comparison-answer generation and translation can make additional paid requests. Only use approved data. Requests set `store: false`; this is not a guarantee of zero provider retention, so review your organization's OpenAI data policies. To run locally instead, select an Ollama model and set `VITE_DEFAULT_LLM` to its name before rebuilding.

### OpenAI TLS certificate errors (corporate networks)

`CERTIFICATE_VERIFY_FAILED: self-signed certificate in certificate chain` means the backend cannot validate the HTTPS certificate chain it received. The request has not reached OpenAI's API processing yet; changing the prompt or model will not fix this. A corporate HTTPS inspection proxy is one possible cause. A host's trusted certificates are not automatically trusted inside Docker.

Obtain the approved root/intermediate CA certificates in PEM format from your IT team (not an arbitrary certificate downloaded from the failing connection). Mount the PEM bundle read-only into the **backend** container and set this in the root `.env_backend`:

```dotenv
OPENAI_CA_BUNDLE=/etc/mygpt-certs/organization-ca.pem
```

For any Docker Compose installation (macOS, Windows, Linux, or server), add a mount to your existing backend service, or use an override such as:

```yaml
services:
  backend:
    volumes:
      - ./organization-ca.pem:/etc/mygpt-certs/organization-ca.pem:ro
```

With the override saved as `compose.ca.yml`, recreate the backend using the same Compose files you normally use plus this override:

```bash
docker compose -f docker-compose.yml -f compose.ca.yml up -d --no-deps --build --force-recreate backend
```

Use the correct CA file location on your host; `OPENAI_CA_BUNDLE` must use the **container** path. For a pre-built image, first pull a version containing this support instead of building. Keep the override in subsequent Compose commands. For a non-Docker backend, set the variable to a local PEM path.

The additional CA applies to both OpenAI LLMs and embeddings; standard public CAs remain trusted. Existing HTTPX `SSL_CERT_FILE`/`SSL_CERT_DIR` and proxy environment settings are still honored. An unreadable or invalid CA bundle fails explicitly. Do **not** use `verify=False` or disable TLS verification.

To check the TLS connection without sending a key, prompt, or paid generation request:

```bash
docker compose -f docker-compose.yml -f compose.ca.yml exec backend python3 manage.py shell -c "import httpx; from testdb.views.openai_client import openai_tls_verification; r = httpx.get('https://api.openai.com/v1/models', verify=openai_tls_verification()); print('TLS connected; HTTP', r.status_code)"
```

An HTTP `401` is expected without an API key: it confirms a TLS connection and an HTTP response, not model access. If verification still fails, ask IT to check the proxy's certificate chain, expiry, and hostname. Then retry generation to verify key/model access separately.

## Run Locally

From the repository root, build and start the database and backend:

```bash
docker compose build backend
docker compose up -d db backend
```

The backend waits for the database health check, applies migrations, collects static files, and starts Django on port `8000` by default. View logs with:

```bash
docker compose logs -f backend
```

Stop the services with `docker compose down`. This leaves the database volume intact.

## API Overview

With the backend running, browse the API root and generated documentation:

- API root: [http://localhost:8000/api/](http://localhost:8000/api/)
- Swagger UI: [http://localhost:8000/api/docs/](http://localhost:8000/api/docs/)
- OpenAPI schema: [http://localhost:8000/api/schema/](http://localhost:8000/api/schema/)

The API includes dataset and document management, conversations and answers, model and embedding configuration, secure media, authentication, and Ollama generation/chat/model-management endpoints. Many endpoints expect JSON POST bodies; consult the OpenAPI schema for request and response fields.

For document chat, `save_answer` returns both equation-based and ML-based
hallucination indices. The live UI displays the mode selected when the answer
was submitted. `get_question_details` also returns the library's current
`HI_by_equation` setting, which chat history uses to choose between the saved
indices. The mode is not stored per answer, so changing the library setting
changes which metric is displayed for existing history.

### Relevance score ranges

Min-max normalized source scores are bounded to 0-1 before weighting or ML
prediction; answer semantic and keyword percentages are therefore bounded to
0-100. Raw distances and BM25 scores are retained separately. Values outside
the configured calibration range saturate at the nearest endpoint rather than
extrapolating into negative or oversized percentages. Negative composite
weights are still supported and apply to these bounded components. Changing
weights does not change embedding distances or their calibration.

Existing saved answers are not recalculated by this change. Regenerate an
answer to replace its source scores and produce new answer metrics. If many
scores saturate, check that the answer distance cutoffs match the library's
embedding model and distance metric.

## Tests

To test an Ollama server directly (bypassing Django), run this from the
repository root. It requires `curl` and `jq` and prints the answer and total
request time:

```bash
bash scripts/test_ollama_direct.sh https://your-ollama-server.example.org llama3:latest
```

The only arguments are server URL and model, defaulting to
`http://localhost:11434` and `llama3`. The GPCR activation-pathways question and
its supplied context are fixed in the script so each server/model test uses
the same input.
The script calls `/api/generate` with streaming disabled and exits nonzero on
HTTP errors, invalid responses, or missing answers.

The backend tests live in `testdb/test_apis_data.py`, `testdb/test_apis_conversations.py`, and `testdb/test_apis_integrations.py`. They use Django `TestCase` and mock external services such as Ollama, YouTube, and embedding utilities.

Run all backend tests from the repository root while the Compose backend and database are running:

```bash
docker compose exec backend python3 manage.py test testdb
```

The same tests can be run with pytest:

```bash
docker compose exec backend python3 -m pytest testdb
```

Run one test module or class when iterating:

```bash
docker compose exec backend python3 manage.py test testdb.test_apis_data
docker compose exec backend python3 manage.py test testdb.test_apis_conversations.ConversationAndAnswerAPITests
docker compose exec backend python3 -m pytest testdb/test_apis_integrations.py -q
```

Both runners create a separate test database and leave the development database untouched. Django may emit timezone warnings while applying legacy migrations; these warnings do not indicate test failures.