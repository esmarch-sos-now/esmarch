"use client";

// Client-side auth wrapper built on SWR over Supabase Auth. The session user lives in the SWR cache under SESSION_KEY;
// Supabase's onAuthStateChange keeps it current (sign-in, sign-out, token refresh, other tabs), and actions that
// sign in or out also write their result straight into that cache. Phone arguments are E.164 (+84…).
import { useCallback, useEffect } from "react";
import useSWR, { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";
import { authApi, authFetch, toUser, type User } from "@/lib/auth/client";
import { createClient } from "@/lib/supabase/client";

export const SESSION_KEY = "supabase:session";

export type SessionStatus = "loading" | "authenticated" | "unauthenticated";

export function useSession() {
  const { data, isLoading, mutate } = useSWR<User | null>(SESSION_KEY, authApi.session, {
    revalidateOnFocus: true,
    shouldRetryOnError: false,
  });
  useEffect(() => {
    const { data: listener } = createClient().auth.onAuthStateChange((_event, session) => {
      void mutate(toUser(session?.user), { revalidate: false });
    });
    return () => listener.subscription.unsubscribe();
  }, [mutate]);
  const user = data ?? null;
  const status: SessionStatus = data === undefined && isLoading ? "loading" : user ? "authenticated" : "unauthenticated";
  return { user, status, mutate };
}

/** A mutation whose result (the signed-in user, or null) replaces the cached session. */
function useSessionMutation<Arg>(run: (arg: Arg) => Promise<User | null>) {
  return useSWRMutation<User | null, Error, string, Arg>(SESSION_KEY, (_key, { arg }) => run(arg), {
    populateCache: true,
    revalidate: false,
  });
}

/** A mutation that does not change the session. */
function useAction<Arg, Data = void>(key: string, run: (arg: Arg) => Promise<Data>) {
  return useSWRMutation<Data, Error, string, Arg>(key, (_key, { arg }) => run(arg));
}

export const useLogin = () =>
  useSessionMutation((arg: { phone: string; password: string }) => authApi.login(arg.phone, arg.password));

/** Signs up and texts a code; the result is the user only when the project skips phone confirmation, otherwise null. */
export const useRegister = () =>
  useSessionMutation((arg: { phone: string; password: string; displayName?: string }) =>
    authApi.register(arg.phone, arg.password, arg.displayName ?? null),
  );

/** Verifies a texted code (sign-up confirmation or password reset); Supabase signs the user in. */
export const useVerifyPhone = () =>
  useSessionMutation((arg: { phone: string; code: string }) => authApi.verifyPhone(arg.phone, arg.code));

export const useSetNewPassword = () =>
  useSessionMutation((arg: { newPassword: string }) => authApi.setNewPassword(arg.newPassword).then(() => null));

export const useChangePassword = () =>
  useSessionMutation((arg: { currentPassword: string; newPassword: string }) =>
    authApi.changePassword(arg.currentPassword, arg.newPassword),
  );

export const useUpdateProfile = () =>
  useSessionMutation((arg: { displayName: string | null }) => authApi.updateProfile(arg.displayName));

export const useLogout = () =>
  useSessionMutation((arg: { everywhere: boolean }) => authApi.logout(arg.everywhere).then(() => null));

export const useResendSignupCode = () =>
  useAction("auth:resend-signup-code", (arg: { phone: string }) => authApi.resendSignupCode(arg.phone));

export const useSendResetCode = () =>
  useAction("auth:send-reset-code", (arg: { phone: string }) => authApi.sendResetCode(arg.phone));

/** fetch() to /backend with `Authorization: Bearer <access token>`; refreshes once on 401. */
export function useAuthFetch() {
  const { mutate } = useSWRConfig();
  return useCallback(
    (path: string, init?: RequestInit) => authFetch(path, init, () => void mutate(SESSION_KEY, null, { revalidate: false })),
    [mutate],
  );
}
