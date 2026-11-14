import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev server reached through a quick tunnel (cloudflared) for outside testers.
  allowedDevOrigins: ["*.trycloudflare.com"],
  reactCompiler: true,
  // The proxy buffers upload bodies (request photos and video); the default 10 MB would cut a video short.
  experimental: { proxyClientMaxBodySize: "30mb" },
  // Browser -> /backend/api/... -> FastAPI /api/... is done in src/proxy.ts, which also adds the session's bearer token.
  async redirects() {
    return [{ source: "/app", destination: "/app/sos", permanent: false }];
  },
};

export default nextConfig;
