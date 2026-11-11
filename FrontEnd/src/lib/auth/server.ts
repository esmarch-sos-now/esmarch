// Server-side auth wrapper for Server Components, Server Functions and Route Handlers.
// Reads the access cookie (already rotated by the proxy when it had expired) and asks the backend who it is.
import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { loginUrl } from "@/lib/auth/paths";
import { ACCESS_COOKIE, backend, fetchUser, type User } from "@/lib/auth/tokens";

export type { User };

async function accessToken(): Promise<string | undefined> {
  return (await cookies()).get(ACCESS_COOKIE)?.value;
}

/** The signed-in user, or null. Deduplicated per request. */
export const getSession = cache(async (): Promise<User | null> => fetchUser(await accessToken()));

/** The signed-in user; otherwise redirects to the login page and comes back to `returnTo` afterwards. */
export async function requireUser(returnTo: string): Promise<User> {
  const user = await getSession();
  if (!user) redirect(loginUrl(returnTo));
  return user;
}

/** Authenticated call to the FastAPI backend (path starts with /api/). */
export async function serverFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return backend(path, { ...init, token: await accessToken() });
}
