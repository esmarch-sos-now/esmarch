// Browser-side auth on Supabase Auth (supabase-js through the @supabase/ssr browser client, so the session lives in
// cookies the server and src/proxy.ts can read). Accounts are a phone number and a password; SMS codes are only used
// to verify the number (at sign-up, and before a password reset). Calls to FastAPI go to /backend/* with
// `Authorization: Bearer <Supabase access token>`, which the backend verifies against the project's signing keys.
import type { AuthError as SupabaseAuthError, User as SupabaseUser } from "@supabase/supabase-js";
import { API_BASE } from "@/lib/api/client";
import { createClient } from "@/lib/supabase/client";

export type User = {
  id: string;
  /** E.164 with the "+", e.g. +84912345678 (empty for accounts without a phone). */
  phone: string;
  displayName: string | null;
  createdAt: string;
  /**
   * "ADMIN" sends the account to /admin. Read from `app_metadata.role`, which only the backend can write (with the
   * service key); it only decides where pages route. The backend checks the role in its database on every call.
   */
  role: Role;
};

export type Role = "USER" | "ADMIN";

export const roleOf = (appMetadata: unknown): Role =>
  (appMetadata as { role?: unknown } | null | undefined)?.role === "ADMIN" ? "ADMIN" : "USER";

/** A failed account action. `code` is Supabase Auth's error code (e.g. "invalid_credentials") or one of ours. */
export class AuthError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message = code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function fail(error: SupabaseAuthError): never {
  // The forms show a friendly Vietnamese message; in development also log Supabase's own reason
  // (e.g. the SMS provider's error behind sms_send_failed).
  if (process.env.NODE_ENV === "development") console.warn("[supabase auth]", error.code, error.status, error.message);
  throw new AuthError(error.status ?? 0, error.code ?? (error.status ? "unexpected_failure" : "network_error"), error.message);
}

/** Supabase stores phone numbers without the "+". */
const e164 = (phone: string | undefined) => (phone ? (phone.startsWith("+") ? phone : `+${phone}`) : "");

export function toUser(user: SupabaseUser | null | undefined): User | null {
  if (!user) return null;
  const name = user.user_metadata?.display_name;
  return {
    id: user.id,
    phone: e164(user.phone),
    displayName: typeof name === "string" && name.trim() ? name : null,
    createdAt: user.created_at,
    role: roleOf(user.app_metadata),
  };
}

const supabase = () => createClient(); // @supabase/ssr returns one shared client in the browser
const cleanName = (name: string | null | undefined) => name?.replace(/\s+/g, " ").trim() || null;

/** `phone` arguments are already E.164 (+84…), see lib/auth/phone.ts. */
export const authApi = {
  /** The session stored in this browser (for display; the backend and server pages verify the token themselves). */
  session: async () => {
    const { data } = await supabase().auth.getSession();
    return toUser(data.session?.user);
  },
  login: async (phone: string, password: string) => {
    const { data, error } = await supabase().auth.signInWithPassword({ phone, password });
    if (error) fail(error);
    introduce();
    return toUser(data.user);
  },
  /** Creates the account and texts a code. Returns the user only when the project skips phone confirmation. */
  register: async (phone: string, password: string, displayName: string | null) => {
    const { data, error } = await supabase().auth.signUp({
      phone,
      password,
      options: { channel: "sms", data: { display_name: cleanName(displayName) } },
    });
    if (error) fail(error);
    return data.session ? toUser(data.user) : null;
  },
  /** Texts a new sign-up code (also for signing in to an account whose number was never confirmed). */
  resendSignupCode: async (phone: string) => {
    const { error } = await supabase().auth.resend({ type: "sms", phone });
    if (error) fail(error);
  },
  /** Confirms the number with the texted code; Supabase then signs the user in. */
  verifyPhone: async (phone: string, code: string) => {
    const { data, error } = await supabase().auth.verifyOtp({ phone, token: code, type: "sms" });
    if (error) fail(error);
    introduce();
    return toUser(data.user);
  },
  /** Password reset, step 1: texts a code to an existing account's number (never creates an account). */
  sendResetCode: async (phone: string) => {
    const { error } = await supabase().auth.signInWithOtp({ phone, options: { shouldCreateUser: false, channel: "sms" } });
    if (error) fail(error);
  },
  // Password reset, step 2 is verifyPhone(): the code proves the number and gives a short-lived session.
  /** Password reset, step 3: set the new password, then end every session so it is used from now on. */
  setNewPassword: async (newPassword: string) => {
    const auth = supabase().auth;
    const { error } = await auth.updateUser({ password: newPassword });
    if (error) fail(error);
    await auth.signOut({ scope: "global" });
  },
  /** Re-checks the current password, then changes it and signs out every other session. */
  changePassword: async (currentPassword: string, newPassword: string) => {
    const auth = supabase().auth;
    const { data: current } = await auth.getUser();
    if (!current.user?.phone) throw new AuthError(401, "not_signed_in");
    const check = await auth.signInWithPassword({ phone: e164(current.user.phone), password: currentPassword });
    if (check.error) {
      if (check.error.code === "invalid_credentials") throw new AuthError(400, "wrong_current_password");
      fail(check.error);
    }
    const { data, error } = await auth.updateUser({ password: newPassword });
    if (error) fail(error);
    await auth.signOut({ scope: "others" });
    return toUser(data.user);
  },
  /** Saves the display name in user_metadata and refreshes the session so the backend's token carries it too. */
  updateProfile: async (displayName: string | null) => {
    const auth = supabase().auth;
    const { error } = await auth.updateUser({ data: { display_name: cleanName(displayName) } });
    if (error) fail(error);
    const refreshed = await auth.refreshSession();
    if (refreshed.error) fail(refreshed.error);
    return toUser(refreshed.data.user);
  },
  logout: async (everywhere: boolean) => {
    const { error } = await supabase().auth.signOut({ scope: everywhere ? "global" : "local" });
    if (error && error.status !== 401 && error.status !== 403) fail(error); // an already-ended session is fine
  },
};

/** Lets the backend know the account (it keeps each account's role and lock, for the admin page). Best effort. */
function introduce() {
  void authFetch("/api/auth/me").catch(() => undefined);
}

/** The current access token, refreshed by supabase-js when it is about to expire. */
async function accessToken(): Promise<string | null> {
  const { data } = await supabase().auth.getSession();
  return data.session?.access_token ?? null;
}

/**
 * fetch() for authenticated backend calls: `authFetch("/api/...")` goes to /backend/api/... with
 * `Authorization: Bearer <access token>`. On a 401 it refreshes the session once and retries; `onSignedOut` runs
 * if there is no session or the refresh fails.
 */
export async function authFetch(path: string, init: RequestInit = {}, onSignedOut?: () => void): Promise<Response> {
  const send = (token: string | null) => {
    const headers = new Headers(init.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(`${API_BASE}${path}`, { ...init, headers, credentials: "omit", cache: "no-store" });
  };
  const first = await send(await accessToken());
  if (first.status !== 401) return first;
  const { data, error } = await supabase().auth.refreshSession();
  if (error || !data.session) {
    onSignedOut?.();
    return first;
  }
  return send(data.session.access_token);
}
