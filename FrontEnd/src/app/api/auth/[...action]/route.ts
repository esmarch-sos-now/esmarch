// Backend-for-frontend for accounts. The browser calls /api/auth/<action>; this handler calls FastAPI, keeps the
// tokens in HttpOnly cookies and only ever returns the user (never a token).
import { NextResponse, type NextRequest } from "next/server";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  backend,
  clearTokenCookies,
  fetchUser,
  isSecure,
  rotate,
  setTokenCookies,
  type TokenPair,
} from "@/lib/auth/tokens";

type Context = { params: Promise<{ action: string[] }> };
type Handler = (request: NextRequest) => Promise<NextResponse>;

const noStore = { "Cache-Control": "no-store" };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: noStore });
}

function empty(status = 204) {
  return new NextResponse(null, { status, headers: noStore });
}

async function readJson(request: NextRequest): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Mirrors a backend error (Problem Details) without leaking anything else. */
async function relayError(response: Response) {
  let detail = "Request failed.";
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === "string") detail = body.detail;
  } catch {}
  const headers: Record<string, string> = { ...noStore };
  const retry = response.headers.get("retry-after");
  if (retry) headers["Retry-After"] = retry;
  return NextResponse.json({ status: response.status, detail }, { status: response.status, headers });
}

function unavailable() {
  return json({ status: 503, detail: "Authentication service is unavailable." }, 503);
}

function post(path: string, body: unknown, token?: string) {
  return backend(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), token });
}

/** Passes a JSON body through to a backend route that issues no tokens. */
function forward(path: string, fields: string[], method = "POST", authenticated = false): Handler {
  return async (request) => {
    const input = await readJson(request);
    const body = Object.fromEntries(fields.map((field) => [field, input[field]]));
    const token = authenticated ? request.cookies.get(ACCESS_COOKIE)?.value : undefined;
    if (authenticated && !token) return json({ status: 401, detail: "Not signed in." }, 401);
    const response = await backend(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      token,
    });
    if (!response.ok) return relayError(response);
    return response.status === 204 ? empty() : json(await response.json(), response.status);
  };
}

/** Stores a freshly issued pair and answers with the signed-in user. */
async function signIn(request: NextRequest, response: Response) {
  if (!response.ok) return relayError(response);
  const pair = (await response.json()) as TokenPair;
  const reply = json({ user: await fetchUser(pair.access_token) });
  setTokenCookies(reply.cookies, pair, isSecure(request.nextUrl));
  return reply;
}

const handlers: Record<string, Record<string, Handler>> = {
  POST: {
    login: async (request) => {
      // `username` is the phone number (or the email of an older account).
      const { username, password } = await readJson(request);
      const form = new URLSearchParams({ username: String(username ?? ""), password: String(password ?? "") });
      const response = await backend("/api/auth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
      });
      return signIn(request, response);
    },
    // Phone sign-up / reset: `idToken` comes from the browser's Firebase SMS sign-in; the backend verifies it.
    "phone-register": async (request) => {
      const { idToken, password, displayName } = await readJson(request);
      return signIn(request, await post("/api/auth/phone/register", { idToken, password, displayName }));
    },
    "phone-reset-password": forward("/api/auth/phone/reset-password", ["idToken", "newPassword"]),
    "verify-email": async (request) => {
      const { email, code } = await readJson(request);
      return signIn(request, await post("/api/auth/verify-email", { email, code }));
    },
    "resend-verification": forward("/api/auth/resend-verification", ["email"]),
    "change-password": async (request) => {
      const token = request.cookies.get(ACCESS_COOKIE)?.value;
      if (!token) return json({ status: 401, detail: "Not signed in." }, 401);
      const { currentPassword, newPassword } = await readJson(request);
      return signIn(request, await post("/api/auth/password/change", { currentPassword, newPassword }, token));
    },
    // Used by the client wrapper after a 401 from /backend (e.g. the access token was revoked server-side).
    refresh: async (request) => {
      const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
      if (!refreshToken) return json({ status: 401, detail: "Not signed in." }, 401);
      const result = await rotate(refreshToken);
      if (!result.ok) {
        if (!result.invalid) return unavailable();
        const reply = json({ status: 401, detail: "Session expired." }, 401);
        clearTokenCookies(reply.cookies);
        return reply;
      }
      const reply = json({ user: await fetchUser(result.pair.access_token) });
      setTokenCookies(reply.cookies, result.pair, isSecure(request.nextUrl));
      return reply;
    },
    logout: async (request) => {
      const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
      if (refreshToken) await post("/api/auth/logout", { refreshToken }).catch(() => undefined);
      const reply = empty();
      clearTokenCookies(reply.cookies);
      return reply;
    },
    "logout-all": async (request) => {
      const token = request.cookies.get(ACCESS_COOKIE)?.value;
      if (token) {
        const response = await post("/api/auth/logout-all", {}, token);
        if (!response.ok && response.status !== 401) return relayError(response);
      }
      const reply = empty();
      clearTokenCookies(reply.cookies);
      return reply;
    },
  },
  GET: {
    // The proxy has already rotated an expired access cookie, so this only needs to read it.
    session: async (request) => json({ user: await fetchUser(request.cookies.get(ACCESS_COOKIE)?.value) }),
  },
  PATCH: {
    profile: forward("/api/auth/me", ["displayName"], "PATCH", true),
  },
};

async function dispatch(request: NextRequest, context: Context) {
  const { action } = await context.params;
  const handler = action.length === 1 ? handlers[request.method]?.[action[0]] : undefined;
  if (!handler) return json({ status: 404, detail: "Not found." }, 404);
  try {
    return await handler(request);
  } catch {
    return unavailable();
  }
}

export { dispatch as GET, dispatch as POST, dispatch as PATCH };
