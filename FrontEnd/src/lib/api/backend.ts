// Server-side URL of the FastAPI backend, used by src/proxy.ts for /backend/*.
export const BACKEND_URL = (process.env.BACKEND_URL ?? "http://localhost:8000").replace(/\/+$/, "");
