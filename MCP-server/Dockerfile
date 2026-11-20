# syntax=docker/dockerfile:1.7

FROM python:3.16-rc-alpine AS base

# Builder stage: install build toolchain for any packages that must compile from source.
FROM base AS builder
RUN apk add --no-cache --virtual .build-deps \
    build-base \
    gcc \
    musl-dev \
    linux-headers \
    python3-dev \
    libffi-dev \
    openssl-dev \
    cargo \
    rust \
    cmake \
    git

RUN pip install --no-cache-dir uv==0.7.21

ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy
WORKDIR /app

# Install locked third-party deps first for cache efficiency.
COPY uv.lock pyproject.toml /app/
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-project

# Copy project files, then install project into the venv.
COPY . /app
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

# Runtime stage: keep only runtime libs, not the full compiler toolchain.
FROM base AS runtime
RUN apk add --no-cache \
    libstdc++ \
    libffi \
    openssl \
    ca-certificates

COPY --from=builder /app /app
COPY --from=builder /usr/local/bin/uv /usr/local/bin/uv

ENV FASTMCP_HOST="0.0.0.0"
ENV FASTMCP_PORT="5001"
ENV PATH="/app/.venv/bin:$PATH"
WORKDIR /app
# Call the venv's python directly; `uv run` would re-resolve/sync deps and,
# without a compiler in this stage, fail on source-only wheels (e.g. cffi on 3.15-rc).
CMD ["python", "mygpt_backend.py", "--host", "0.0.0.0", "--port", "5001", "--log-level", "debug"]