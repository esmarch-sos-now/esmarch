import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev server reached through a quick tunnel (cloudflared) for outside testers.
  allowedDevOrigins: ["*.trycloudflare.com"],
  reactCompiler: true,
  // Browser -> /backend/api/... -> FastAPI /api/... is done in src/proxy.ts, which also adds the session's bearer token.
  async redirects() {
    return [{ source: "/app", destination: "/app/sos", permanent: false }];
  },
};

export default nextConfig;
