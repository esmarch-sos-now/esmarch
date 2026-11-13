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
import { SmsError, type SmsErrorCode } from "@/lib/auth/firebase";

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

const smsMessages: Record<SmsErrorCode, string> = {
  "not-configured": errors.smsNotConfigured,
  "invalid-phone": errors.invalidPhone,
  "invalid-code": errors.invalidCode,
  "code-expired": errors.codeExpired,
  "too-many-requests": errors.tooMany,
  "quota-exceeded": errors.smsQuota,
  "captcha-failed": errors.captchaFailed,
  network: errors.unavailable,
  unknown: errors.generic,
};

/** Maps a backend/BFF error or a Firebase SMS error to a Vietnamese message. Backend details are stable English strings. */
export function errorMessage(error: unknown, context: "login" | "default" = "default"): string {
  if (error instanceof SmsError) return smsMessages[error.code];
  if (!(error instanceof AuthError)) return errors.generic;
  if (error.detail === "Phone verification is not configured.") return errors.smsNotConfigured;
  if (error.status === 0 || error.status >= 500) return errors.unavailable;
  if (error.detail === "Phone number already registered.") return errors.phoneTaken;
  if (error.detail === "No account for this phone number.") return errors.phoneUnknown;
  if (error.detail === "Invalid or expired phone verification.") return errors.phoneSessionExpired;
  if (error.status === 429) return errors.tooMany;
  if (error.status === 401 && context === "login") return errors.invalidLogin;
  if (error.detail === "Invalid or expired code.") return errors.invalidCode;
  if (error.detail === "Invalid email address.") return errors.invalidEmail;
  if (error.detail === "Current password is incorrect.") return errors.wrongCurrent;
  if (error.detail === "This account is disabled.") return errors.disabled;
  return errors.generic;
}

/** Puts a failed submission on the matching field (by backend detail) or on the form as `root.server`. */
export function reportError<T extends FieldValues>(
  setError: UseFormSetError<T>,
  error: unknown,
  fields: Partial<Record<string, FieldPath<T>>> = {},
  context?: "login",
) {
  const message = errorMessage(error, context);
  const field = error instanceof AuthError ? fields[error.detail] : undefined;
  if (field) setError(field, { type: "server", message }, { shouldFocus: true });
  else setError("root.server" as FieldPath<T>, { type: "server", message });
}

export const isUnverified = (error: unknown) =>
  error instanceof AuthError && error.status === 403 && error.detail === "Email address is not verified.";

/** Login/register pages send an already signed-in visitor on to their destination. */
export function useRedirectIfSignedIn(next: string, enabled = true) {
  const { status } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (enabled && status === "authenticated") router.replace(next);
  }, [enabled, status, next, router]);
}
