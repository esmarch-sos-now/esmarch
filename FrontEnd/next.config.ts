import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev server reached through a quick tunnel (cloudflared) for outside testers.
  allowedDevOrigins: ["*.trycloudflare.com"],
  reactCompiler: true,
  // The proxy buffers request bodies (default 10 MB). Only the local-dev video fallback (no Supabase Storage) posts up
  // to 25 MB through it; with Storage the browser uploads the video straight to the bucket.
  experimental: { proxyClientMaxBodySize: "30mb" },
  // Browser -> /backend/api/... -> FastAPI /api/... is done in src/proxy.ts, which also adds the session's bearer token.
  async redirects() {
    return [{ source: "/app", destination: "/app/sos", permanent: false }];
  },
};

export default nextConfig;
