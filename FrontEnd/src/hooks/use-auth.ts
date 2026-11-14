"use client";

// Client-side auth wrapper built on SWR. The session lives in the SWR cache under SESSION_KEY; every action is a
// useSWRMutation, and the ones that sign in or out write the resulting user straight into that cache
// (populateCache), so the navbar and every other useSession() update without another request.
import { useCallback } from "react";
import useSWR, { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";
import { authApi, authFetch, type User } from "@/lib/auth/client";

export const SESSION_KEY = "/api/auth/session";

export type SessionStatus = "loading" | "authenticated" | "unauthenticated";

export function useSession() {
  const { data, isLoading, mutate } = useSWR<User | null>(SESSION_KEY, authApi.session, {
    revalidateOnFocus: true, // notice a sign-out in another tab
    shouldRetryOnError: false,
  });
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
  useSessionMutation((arg: { username: string; password: string }) => authApi.login(arg.username, arg.password));

export const usePhoneRegister = () =>
  useSessionMutation((arg: { idToken: string; password: string; displayName?: string }) =>
    authApi.phoneRegister(arg.idToken, arg.password, arg.displayName),
  );

export const usePhoneResetPassword = () =>
  useAction("/api/auth/phone-reset-password", (arg: { idToken: string; newPassword: string }) =>
    authApi.phoneResetPassword(arg.idToken, arg.newPassword),
  );

export const useVerifyEmail = () =>
  useSessionMutation((arg: { email: string; code: string }) => authApi.verifyEmail(arg.email, arg.code));

export const useChangePassword = () =>
  useSessionMutation((arg: { currentPassword: string; newPassword: string }) =>
    authApi.changePassword(arg.currentPassword, arg.newPassword),
  );

export const useUpdateProfile = () =>
  useSessionMutation((arg: { displayName: string | null }) => authApi.updateProfile(arg.displayName));

export const useLogout = () =>
  useSessionMutation((arg: { everywhere: boolean }) =>
    (arg.everywhere ? authApi.logoutAll() : authApi.logout()).then(() => null),
  );

export const useResendVerification = () =>
  useAction("/api/auth/resend-verification", (arg: { email: string }) => authApi.resendVerification(arg.email));

/** fetch() to /backend with the session (the proxy adds the bearer token); refreshes once on 401. */
export function useAuthFetch() {
  const { mutate } = useSWRConfig();
  return useCallback(
    (path: string, init?: RequestInit) => authFetch(path, init, () => void mutate(SESSION_KEY, null, { revalidate: false })),
    [mutate],
  );
}
