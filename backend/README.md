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