// Browser-side auth calls. Everything goes to the Next origin: /api/auth/* for account actions (tokens stay in
// HttpOnly cookies), /backend/* for API calls that the proxy signs with the access token.
import { API_BASE } from "@/lib/api/client";

export type User = {
  id: string;
  email: string | null;
  phone: string | null; // E.164, e.g. +84912345678
  displayName: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  role: "USER" | "ADMIN";
  createdAt: string;
};

export class AuthError extends Error {
  status: number;
  detail: string;
  retryAfter: number;
  constructor(status: number, detail: string, retryAfter = 0) {
    super(detail);
    this.status = status;
    this.detail = detail;
    this.retryAfter = retryAfter;
  }
}

async function call<T>(path: string, method: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/auth/${path}`, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers: body === undefined ? { Accept: "application/json" } : { Accept: "application/json", "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new AuthError(0, "Network error.");
  }
  if (!response.ok) {
    let detail = "Request failed.";
    try {
      const payload = (await response.json()) as { detail?: string };
      if (payload.detail) detail = payload.detail;
    } catch {}
    const retry = Number(response.headers.get("retry-after") ?? 0);
    throw new AuthError(response.status, detail, Number.isFinite(retry) ? retry : 0);
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}

type WithUser = { user: User | null };

export const authApi = {
  session: () => call<WithUser>("session", "GET").then((r) => r.user),
  login: (username: string, password: string) => call<WithUser>("login", "POST", { username, password }).then((r) => r.user),
  phoneRegister: (idToken: string, password: string, displayName?: string) =>
    call<WithUser>("phone-register", "POST", { idToken, password, displayName: displayName || null }).then((r) => r.user),
  phoneResetPassword: (idToken: string, newPassword: string) =>
    call<void>("phone-reset-password", "POST", { idToken, newPassword }),
  verifyEmail: (email: string, code: string) => call<WithUser>("verify-email", "POST", { email, code }).then((r) => r.user),
  resendVerification: (email: string) => call<void>("resend-verification", "POST", { email }),
  changePassword: (currentPassword: string, newPassword: string) =>
    call<WithUser>("change-password", "POST", { currentPassword, newPassword }).then((r) => r.user),
  updateProfile: (displayName: string | null) => call<User>("profile", "PATCH", { displayName }),
  refresh: () => call<WithUser>("refresh", "POST").then((r) => r.user),
  logout: () => call<void>("logout", "POST"),
  logoutAll: () => call<void>("logout-all", "POST"),
};

// One refresh at a time, however many requests got a 401 together.
let refreshing: Promise<User | null> | null = null;

export function refreshSession(): Promise<User | null> {
  refreshing ??= authApi
    .refresh()
    .catch(() => null)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/**
 * fetch() for authenticated backend calls: `authFetch("/api/...")` goes to /backend/api/... with cookies, and the
 * proxy adds the bearer token. On a 401 it refreshes the session once and retries; `onSignedOut` runs if that fails.
 */
export async function authFetch(path: string, init: RequestInit = {}, onSignedOut?: () => void): Promise<Response> {
  const send = () => fetch(`${API_BASE}${path}`, { ...init, credentials: "same-origin", cache: "no-store" });
  const first = await send();
  if (first.status !== 401) return first;
  const user = await refreshSession();
  if (!user) {
    onSignedOut?.();
    return first;
  }
  return send();
}
