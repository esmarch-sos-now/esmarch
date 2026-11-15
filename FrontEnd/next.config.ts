import type { NextConfig } from "next";
import { BACKEND_URL } from "./src/lib/api/backend";

const nextConfig: NextConfig = {
  // Dev server reached through a quick tunnel (cloudflared) for outside testers.
  allowedDevOrigins: ["*.trycloudflare.com"],
  reactCompiler: true,
  async redirects() {
    return [{ source: "/app", destination: "/app/sos", permanent: false }];
  },
  // Browser -> /backend/api/... -> FastAPI /api/... An external rewrite here, not NextResponse.rewrite in src/proxy.ts:
  // on Vercel an external rewrite from the (Node.js) proxy is answered with the 404 page, while config rewrites run in
  // Vercel's routing layer. src/proxy.ts still runs first (rejects cross-origin writes, strips cookies, sets the IP).
  // BACKEND_URL is read when the config loads: at build time on Vercel, at start-up under `next dev`.
  async rewrites() {
    return {
      beforeFiles: [{ source: "/backend/:path*", destination: `${BACKEND_URL}/:path*` }],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
