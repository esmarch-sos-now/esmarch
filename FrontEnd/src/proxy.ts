// Runs before every page, RSC request and /backend call:
//  1. Pages: refreshes the Supabase session cookies (lib/supabase/proxy.ts), guards protected pages and keeps ADMIN
//     accounts inside /admin.
//  2. /backend/*: proxies to FastAPI unchanged. The browser already sends `Authorization: Bearer <Supabase access
//     token>` (lib/auth/client.ts authFetch) and FastAPI verifies it; cookies are dropped on the way.
//  3. Rejects cross-origin state-changing requests to /backend and /api.
import { NextResponse, type NextRequest } from "next/server";
import { BACKEND_URL } from "@/lib/api/backend";
import { updateSession } from "@/lib/supabase/proxy";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function crossOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false; // non-browser clients
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

function problem(status: number, detail: string) {
  return NextResponse.json({ status, detail }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const toBackend = pathname === "/backend" || pathname.startsWith("/backend/");
  const isApi = toBackend || pathname.startsWith("/api/");

  if (isApi && !SAFE_METHODS.has(request.method) && crossOrigin(request)) {
    return problem(403, "Cross-origin request rejected.");
  }
  if (toBackend) {
    const headers = new Headers(request.headers);
    headers.delete("cookie"); // the backend authenticates by bearer token only
    // The caller's IP for the backend's per-IP limits (it trusts this header only when CLIENT_IP_HEADER says so).
    // Never the browser's own value: Vercel sets x-vercel-forwarded-for / x-forwarded-for at its edge.
    headers.delete("x-sosnow-client-ip");
    const ip =
      request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-forwarded-for")?.split(",")[0];
    if (ip?.trim()) headers.set("x-sosnow-client-ip", ip.trim());
    const target = new URL(`${BACKEND_URL}${pathname.slice("/backend".length) || "/"}${search}`);
    return NextResponse.rewrite(target, { request: { headers } });
  }
  return updateSession(request);
}

export const config = {
  // Everything except build assets and static files.
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|favicon\\.svg|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|glb|gltf|css|js|map|txt|woff2?)$).*)"],
};
