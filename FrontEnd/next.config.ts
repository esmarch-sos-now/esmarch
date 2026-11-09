import type { NextConfig } from "next";

// Server-side URL of the FastAPI backend (docker compose service name by default for dev outside compose: localhost).
const BACKEND_URL = (process.env.BACKEND_URL ?? "http://localhost:8000").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  reactCompiler: true,
  async rewrites() {
    // Browser -> /backend/api/... -> FastAPI /api/... (dedicated prefix, no clash with Next's own routes).
    return [{ source: "/backend/:path*", destination: `${BACKEND_URL}/:path*` }];
  },
  async redirects() {
    return [{ source: "/app", destination: "/app/sos", permanent: false }];
  },
};

export default nextConfig;
