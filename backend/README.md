# MyGPT Backend

The backend is a Django and Django REST Framework application. It serves the MyGPT API, stores datasets and conversation records in PostgreSQL, and connects to Ollama and the vector database for retrieval and model operations.

## Requirements

- Docker Desktop with Docker Compose
- A repository-root `.env_backend` file, created from `.env_backend.example`
- A repository-root `.env_frontend` file for the full application Compose setup
- Ollama running on the host if you need model-backed endpoints; the Compose backend defaults to `http://host.docker.internal:11434`

Create the ignored environment files from the repository root if they do not already exist:

```bash
cp .env_backend.example .env_backend
cp .env_frontend.example .env_frontend
```

Set secure database and Django values in `.env_backend`. Do not commit either environment file, and do not put secrets in `.env_frontend`; `VITE_` values are exposed to browser clients.

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