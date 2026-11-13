"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import type { ConfirmationResult } from "firebase/auth";
import type * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useLogout, usePhoneResetPassword } from "@/hooks/use-auth";
import { authCopy } from "@/content/auth";
import { AuthError } from "@/lib/auth/client";
import { sendSmsCode } from "@/lib/auth/firebase";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { forgotSchema, formatPhone, normalizePhone, resetSchema } from "@/lib/auth/schemas";
import { FormAlert, reportError } from "./form-fields";
import SmsCodeStep from "./sms-code-step";

const copy = authCopy.forgot;
const { fields } = authCopy;
const submitClass = "h-11 w-full rounded-full text-base font-semibold";
const RECAPTCHA_ID = "forgot-recaptcha";

type Step =
  | { kind: "phone" }
  | { kind: "code"; phone: string; confirmation: ConfirmationResult }
  | { kind: "password"; phone: string; idToken: string };

/** Step 1: phone number, an SMS code is sent. Step 2: enter the code. Step 3: choose the new password. */
export default function ForgotPasswordForm() {
  const [step, setStep] = useState<Step>({ kind: "phone" });
  const restart = () => setStep({ kind: "phone" });
  return (
    <>
      <div id={RECAPTCHA_ID} />
      {step.kind === "phone" && <RequestCode onSent={(phone, confirmation) => setStep({ kind: "code", phone, confirmation })} />}
      {step.kind === "code" && (
        <SmsCodeStep
          phone={step.phone}
          confirmation={step.confirmation}
          recaptchaId={RECAPTCHA_ID}
          onVerified={async (idToken) => setStep({ kind: "password", phone: step.phone, idToken })}
          onBack={restart}
        />
      )}
      {step.kind === "password" && <NewPassword phone={step.phone} idToken={step.idToken} onRestart={restart} />}
    </>
  );
}

function RequestCode({ onSent }: { onSent: (phone: string, confirmation: ConfirmationResult) => void }) {
  const form = useForm<z.infer<typeof forgotSchema>>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { phone: "" },
  });

  async function onSubmit(data: z.infer<typeof forgotSchema>) {
    const phone = normalizePhone(data.phone);
    if (!phone) return;
    try {
      onSent(phone, await sendSmsCode(phone, RECAPTCHA_ID));
    } catch (error) {
      reportError(form.setError, error);
    }
  }

  return (
    <Card className="w-full rounded-3xl [--card-spacing:--spacing(6)]">
      <CardHeader>
        <CardTitle className="text-3xl font-black text-ink">{copy.title}</CardTitle>
        <CardDescription className="text-base">{copy.lede}</CardDescription>
      </CardHeader>
      <CardContent>
        <form id="form-forgot" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Controller
              name="phone"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="form-forgot-phone">{fields.phone}</FieldLabel>
                  <Input
                    {...field}
                    id="form-forgot-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    placeholder="0912 345 678"
                    maxLength={20}
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <FormAlert error={form.formState.errors.root?.server?.message} />
          </FieldGroup>
        </form>
      </CardContent>
      <CardFooter className="flex-col gap-4">
        <Button type="submit" form="form-forgot" size="lg" className={submitClass} disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Spinner data-icon="inline-start" />}
          {copy.submit}
        </Button>
        <Link className="text-sm font-medium text-brand hover:underline" href={LOGIN_PATH}>{copy.backToLogin}</Link>
      </CardFooter>
    </Card>
  );
}

function NewPassword({ phone, idToken, onRestart }: { phone: string; idToken: string; onRestart: () => void }) {
  const router = useRouter();
  const reset = usePhoneResetPassword();
  const logout = useLogout();
  const form = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: "", confirm: "" },
  });

  async function onSubmit(data: z.infer<typeof resetSchema>) {
    try {
      await reset.trigger({ idToken, newPassword: data.password });
      // The backend revoked every session, but this browser's short-lived access cookie would still work: drop it so
      // the login page asks for the new password instead of redirecting a "signed-in" visitor.
      await logout.trigger({ everywhere: false }).catch(() => undefined);
      router.replace(`${LOGIN_PATH}?reset=1`);
    } catch (error) {
      reportError(form.setError, error);
    }
  }

  const error = reset.error;
  const needsNewCode = error instanceof AuthError && (error.status === 400 || error.status === 404);

  return (
    <Card className="w-full rounded-3xl [--card-spacing:--spacing(6)]">
      <CardHeader>
        <CardTitle className="text-3xl font-black text-ink">{copy.newPasswordTitle}</CardTitle>
        <CardDescription className="text-base">{copy.newPasswordLede(formatPhone(phone))}</CardDescription>
      </CardHeader>
      <CardContent>
        <form id="form-reset" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Controller
              name="password"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="form-reset-password">{fields.newPassword}</FieldLabel>
                  <Input {...field} id="form-reset-password" type="password" autoComplete="new-password" maxLength={128} autoFocus aria-invalid={fieldState.invalid} />
                  <FieldDescription>{authCopy.hints.password}</FieldDescription>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              name="confirm"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="form-reset-confirm">{fields.confirmPassword}</FieldLabel>
                  <Input {...field} id="form-reset-confirm" type="password" autoComplete="new-password" aria-invalid={fieldState.invalid} />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <FormAlert error={form.formState.errors.root?.server?.message} />
          </FieldGroup>
        </form>
      </CardContent>
      <CardFooter className="flex-col gap-3">
        <Button type="submit" form="form-reset" size="lg" className={submitClass} disabled={form.formState.isSubmitting || needsNewCode}>
          {form.formState.isSubmitting && <Spinner data-icon="inline-start" />}
          {copy.resetSubmit}
        </Button>
        <Button type="button" variant="link" className="h-auto px-0 text-muted-foreground" onClick={onRestart}>{authCopy.sms.back}</Button>
      </CardFooter>
    </Card>
  );
}
