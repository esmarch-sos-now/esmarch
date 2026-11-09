# Esmarch — SOS NOW

Monorepo: **FrontEnd** (Next.js 16, SWR, Mapbox GL JS) · **BackEnd** (FastAPI, SQLModel, PostgreSQL 18) · `archieved/` (legacy Spring Boot + Vite repos, kept for reference).

## Run (Docker Compose)

```bash
cp FrontEnd/.env.example FrontEnd/.env   # set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to show the map
docker compose up -d --build
```

| Service  | URL                    | Notes |
| -------- | ---------------------- | ----- |
| frontend | http://localhost:3001  | `FRONTEND_PORT` to change; proxies `/backend/*` to the API |
| backend  | http://localhost:8000  | OpenAPI docs at `/docs`; migrations + seed run on start |
| db       | localhost:5432         | user/password/db: `esmarch` |

- Seed data lives in `BackEnd/data/seeds/*.json` and is loaded by `python -m app.seeds` (idempotent).
- Backend checks: `uv run pytest`, `uv run pyrefly check`, `uv run ruff check .` (tests need the db service running).
- Frontend checks: `npm run typecheck && npm run lint`.
