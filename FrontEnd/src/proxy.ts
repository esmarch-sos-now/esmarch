// Runs before every page, RSC request and /backend call:
//  1. Rotates tokens: an expired access cookie plus a refresh cookie is exchanged for a new pair, and the
//     new cookies are applied to both the response (browser) and the forwarded request (server components).
//  2. Proxies /backend/* to FastAPI, adding `Authorization: Bearer <access>` from the cookie.
//  3. Guards protected pages and rejects cross-origin state-changing requests.
//  4. Keeps ADMIN accounts inside /admin (management only).
import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_PATH, isAdminPath, isProtected, loginUrl } from "@/lib/auth/paths";
import {
  ACCESS_COOKIE,
  BACKEND_URL,
  REFRESH_COOKIE,
  clearTokenCookies,
  isSecure,
  rotate,
  setTokenCookies,
  type TokenPair,
} from "@/lib/auth/tokens";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
// Backend routes that return tokens: reachable only through the /api/auth handlers, never from the browser.
const TOKEN_ROUTES = new Set(["token", "refresh", "verify-email", "password/change"].map((route) => `/backend/api/auth/${route}`));
// These handlers manage the refresh cookie themselves; rotating it here first would only waste a token.
const SELF_MANAGED = new Set(["/api/auth/refresh", "/api/auth/logout"]);

function crossOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false; // non-browser clients; SameSite=Lax cookies already stop cross-site form posts
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

/**
 * Whether the access token says ADMIN. Read without verifying the signature: it only decides where pages route
 * (an admin account is kept inside /admin), while the backend checks the role in the database on every call.
 */
function isAdminToken(token: string): boolean {
  try {
    const payload = token.split(".")[1] ?? "";
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "="));
    return (JSON.parse(json) as { role?: unknown }).role === "ADMIN";
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const toBackend = pathname === "/backend" || pathname.startsWith("/backend/");
  const isApi = toBackend || pathname.startsWith("/api/");

  if (isApi && !SAFE_METHODS.has(request.method) && crossOrigin(request)) {
    return problem(403, "Cross-origin request rejected.");
  }
  if (toBackend) {
    // Compare the path the backend will see: percent-decoded, repeated and trailing slashes collapsed.
    let decoded: string;
    try {
      decoded = decodeURIComponent(pathname);
    } catch {
      return problem(400, "Malformed path.");
    }
    if (TOKEN_ROUTES.has(decoded.replace(/\/{2,}/g, "/").replace(/\/+$/, "").toLowerCase())) return problem(404, "Not found.");
  }

  let access = request.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  let rotated: TokenPair | null = null;
  let expired = false;

  if (!access && refresh && !SELF_MANAGED.has(pathname)) {
    const result = await rotate(refresh);
    if (result.ok) {
      rotated = result.pair;
      access = rotated.access_token;
      request.cookies.set(ACCESS_COOKIE, rotated.access_token);
      request.cookies.set(REFRESH_COOKIE, rotated.refresh_token);
    } else if (result.invalid) {
      expired = true;
      request.cookies.delete(REFRESH_COOKIE);
    }
  }

  let response: NextResponse;
  if (!access && isProtected(pathname)) {
    response = NextResponse.redirect(new URL(loginUrl(pathname + search), request.url));
  } else if (!isApi && access && isAdminToken(access) && !isAdminPath(pathname)) {
    // Admin accounts only manage: every user-facing page (SOS, assistant, account…) sends them to the admin area.
    response = NextResponse.redirect(new URL(ADMIN_PATH, request.url));
  } else if (toBackend) {
    const headers = new Headers(request.headers);
    headers.delete("cookie"); // the backend has no use for the refresh token
    if (access && !headers.has("authorization")) headers.set("authorization", `Bearer ${access}`);
    const target = new URL(`${BACKEND_URL}${pathname.slice("/backend".length) || "/"}${search}`);
    response = NextResponse.rewrite(target, { request: { headers } });
  } else {
    response = NextResponse.next({ request: { headers: new Headers(request.headers) } });
  }

  if (rotated) setTokenCookies(response.cookies, rotated, isSecure(request.nextUrl));
  else if (expired) clearTokenCookies(response.cookies);
  return response;
}

export const config = {
  // Everything except build assets and static files.
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|favicon\\.svg|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|glb|gltf|css|js|map|txt|woff2?)$).*)"],
};
