// Server-side token plumbing shared by the proxy (src/proxy.ts) and the /api/auth route handlers.
// Tokens live only in HttpOnly cookies on the Next origin; browser JavaScript never sees them.
import "server-only";
import type { NextResponse } from "next/server";

type ResponseCookies = NextResponse["cookies"];

// Browsers share cookies between ports of the same host (localhost:3001 and localhost:3002 would be one login).
// Setting SESSION_COOKIE_SUFFIX on a site gives it its own cookie names, so two sites on one host sign in separately.
const suffix = (process.env.SESSION_COOKIE_SUFFIX ?? "").replace(/[^A-Za-z0-9_-]/g, "");
export const ACCESS_COOKIE = suffix ? `esm_at_${suffix}` : "esm_at";
export const REFRESH_COOKIE = suffix ? `esm_rt_${suffix}` : "esm_rt";

export const BACKEND_URL = (process.env.BACKEND_URL ?? "http://localhost:8000").replace(/\/+$/, "");

/** OAuth2 token response from FastAPI (snake_case per RFC 6749). */
export type TokenPair = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  refresh_expires_in: number;
};

export type { User } from "@/lib/auth/client";
import type { User } from "@/lib/auth/client";

/** Expire the access cookie a little before the JWT so the proxy refreshes ahead of a 401. */
const ACCESS_SKEW_SECONDS = 30;

export function setTokenCookies(cookies: ResponseCookies, pair: TokenPair, secure: boolean) {
  const base = { httpOnly: true, secure, sameSite: "lax" as const, path: "/" };
  cookies.set(ACCESS_COOKIE, pair.access_token, { ...base, maxAge: Math.max(30, pair.expires_in - ACCESS_SKEW_SECONDS) });
  cookies.set(REFRESH_COOKIE, pair.refresh_token, { ...base, maxAge: pair.refresh_expires_in });
}

export function clearTokenCookies(cookies: ResponseCookies) {
  cookies.delete(ACCESS_COOKIE);
  cookies.delete(REFRESH_COOKIE);
}

export function isSecure(url: URL): boolean {
  return url.protocol === "https:" || process.env.NODE_ENV === "production";
}

/** Calls the FastAPI backend from the Next server. */
export function backend(path: string, init: RequestInit & { token?: string } = {}): Promise<Response> {
  const { token, headers, ...rest } = init;
  const merged = new Headers(headers);
  merged.set("Accept", "application/json");
  if (token) merged.set("Authorization", `Bearer ${token}`);
  return fetch(`${BACKEND_URL}${path}`, { ...rest, headers: merged, cache: "no-store", signal: AbortSignal.timeout(8000) });
}

export type RotateResult = { ok: true; pair: TokenPair } | { ok: false; invalid: boolean };

// Parallel requests (page, RSC payloads, prefetches) often arrive together with the same expired session.
// Share one rotation per refresh token and remember its result briefly, so they all get the same new pair
// instead of racing the backend's reuse detection. Per-process; the backend's grace window covers the rest.
const inflight = new Map<string, { at: number; result: Promise<RotateResult> }>();
const REMEMBER_MS = 10_000;

export function rotate(refreshToken: string): Promise<RotateResult> {
  const now = Date.now();
  for (const [key, entry] of inflight) if (now - entry.at > REMEMBER_MS) inflight.delete(key);
  const existing = inflight.get(refreshToken);
  if (existing) return existing.result;
  const result = (async (): Promise<RotateResult> => {
    try {
      const response = await backend("/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (response.ok) return { ok: true, pair: (await response.json()) as TokenPair };
      return { ok: false, invalid: response.status === 401 || response.status === 400 };
    } catch {
      return { ok: false, invalid: false }; // backend unreachable: keep the cookies, try again later
    }
  })();
  inflight.set(refreshToken, { at: now, result });
  return result;
}

/** Current user for an access token; null when the token is missing or rejected. */
export async function fetchUser(accessToken: string | undefined): Promise<User | null> {
  if (!accessToken) return null;
  try {
    const response = await backend("/api/auth/me", { token: accessToken });
    return response.ok ? ((await response.json()) as User) : null;
  } catch {
    return null;
  }
}
