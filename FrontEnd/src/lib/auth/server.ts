// Server-side auth for Server Components, Server Functions and Route Handlers. Per the Supabase SSR guide, pages are
// protected with getClaims(), which verifies the access token's signature (never trust getSession() on the server).
import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@/lib/auth/client";
import { loginUrl } from "@/lib/auth/paths";
import { createClient } from "@/lib/supabase/server";

export type { User };

/** The signed-in user from the verified token claims, or null. Deduplicated per request. */
export const getSession = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims || claims.is_anonymous) return null;
  const name = claims.user_metadata?.display_name;
  // `created_at` is not a token claim; the account page reads it from the browser session (lib/auth/client.ts).
  const phone = typeof claims.phone === "string" && claims.phone ? claims.phone : "";
  return {
    id: claims.sub,
    phone: phone && !phone.startsWith("+") ? `+${phone}` : phone, // Supabase stores numbers without the "+"
    displayName: typeof name === "string" && name.trim() ? name : null,
    createdAt: "",
  };
});

/** The signed-in user; otherwise redirects to the login page and comes back to `returnTo` afterwards. */
export async function requireUser(returnTo: string): Promise<User> {
  const user = await getSession();
  if (!user) redirect(loginUrl(returnTo));
  return user;
}
