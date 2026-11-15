"use client";

// Shared bits for the account forms. The fields themselves follow the shadcn React Hook Form guide
// (https://ui.shadcn.com/docs/forms/react-hook-form): Controller + Field/FieldLabel/FieldError, written in each form.
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { FieldPath, FieldValues, UseFormSetError } from "react-hook-form";
import { CircleAlert, CircleCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useSession } from "@/hooks/use-auth";
import { authCopy } from "@/content/auth";
import { AuthError } from "@/lib/auth/client";

const { errors } = authCopy;

/** Form-level message: react-hook-form's `root.server` error, or a success notice. */
export function FormAlert({ error, success }: { error?: string; success?: string | null }) {
  if (error)
    return (
      <Alert variant="destructive" className="border-destructive/30 bg-brand-soft">
        <CircleAlert aria-hidden="true" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  if (success)
    return (
      <Alert role="status" className="border-emerald-200 bg-emerald-50 text-emerald-900">
        <CircleCheck aria-hidden="true" />
        <AlertDescription className="text-emerald-900">{success}</AlertDescription>
      </Alert>
    );
  return null;
}

// Supabase Auth error codes (https://supabase.com/docs/guides/auth/debugging/error-codes) plus our own.
const MESSAGES: Record<string, string> = {
  invalid_credentials: errors.invalidLogin,
  phone_not_confirmed: errors.phoneNotConfirmed,
  phone_exists: errors.phoneTaken,
  user_already_exists: errors.phoneTaken,
  otp_expired: errors.invalidCode, // Supabase's answer to a wrong as well as an expired code
  otp_disabled: errors.phoneUnknown, // signInWithOtp({ shouldCreateUser: false }) for a number without an account
  sms_send_failed: errors.smsFailed,
  phone_provider_disabled: errors.smsDisabled,
  validation_failed: errors.invalidPhone,
  weak_password: errors.weakPassword,
  same_password: errors.samePassword,
  wrong_current_password: errors.wrongCurrent,
  user_banned: errors.disabled,
  over_sms_send_rate_limit: errors.tooMany,
  over_request_rate_limit: errors.tooMany,
  signup_disabled: errors.signupDisabled,
};

/** Maps a Supabase Auth error to a Vietnamese message. */
export function errorMessage(error: unknown): string {
  if (!(error instanceof AuthError)) return errors.generic;
  if (MESSAGES[error.code]) return MESSAGES[error.code];
  if (error.status === 429) return errors.tooMany;
  if (error.status === 0 || error.status >= 500) return errors.unavailable;
  return errors.generic;
}

/** Puts a failed submission on the matching field (by error code) or on the form as `root.server`. */
export function reportError<T extends FieldValues>(
  setError: UseFormSetError<T>,
  error: unknown,
  fields: Partial<Record<string, FieldPath<T>>> = {},
) {
  const message = errorMessage(error);
  const field = error instanceof AuthError ? fields[error.code] : undefined;
  if (field) setError(field, { type: "server", message }, { shouldFocus: true });
  else setError("root.server" as FieldPath<T>, { type: "server", message });
}

export const isUnverified = (error: unknown) => error instanceof AuthError && error.code === "phone_not_confirmed";

/** Login/register pages send an already signed-in visitor on to their destination. */
export function useRedirectIfSignedIn(next: string, enabled = true) {
  const { status } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (enabled && status === "authenticated") router.replace(next);
  }, [enabled, status, next, router]);
}
