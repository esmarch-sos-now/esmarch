FROM python:3.15-slim
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PROJECT_ENVIRONMENT=/opt/venv PATH="/opt/venv/bin:$PATH"
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project
COPY . .
EXPOSE 8000
# Single worker: Phase 3 presence/requests live in process memory. No access log: URLs carry coordinates.
CMD ["sh", "-c", "python -m app.deploy && exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --no-access-log --reload"]
