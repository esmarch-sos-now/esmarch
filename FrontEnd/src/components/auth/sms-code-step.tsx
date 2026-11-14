"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import type { ConfirmationResult } from "firebase/auth";
import type * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Spinner } from "@/components/ui/spinner";
import { authCopy } from "@/content/auth";
import { AuthError } from "@/lib/auth/client";
import { SmsError, confirmSmsCode, sendSmsCode } from "@/lib/auth/firebase";
import { formatPhone, verifySchema } from "@/lib/auth/schemas";
import { FormAlert, errorMessage } from "./form-fields";

const COOLDOWN = 60;
const copy = authCopy.sms;

/**
 * Second step of phone sign-up and password reset: enter the SMS code. Mounted right after the first code was sent
 * (so the resend cooldown starts now). `onVerified` gets the Firebase ID token proving the number; when it throws,
 * the error shows here and the token is kept so the user can retry without a new SMS.
 */
export default function SmsCodeStep({
  phone,
  confirmation: initial,
  recaptchaId,
  onVerified,
  onBack,
}: {
  phone: string;
  confirmation: ConfirmationResult;
  recaptchaId: string;
  onVerified: (idToken: string) => Promise<void>;
  onBack: () => void;
}) {
  const form = useForm<z.infer<typeof verifySchema>>({ resolver: zodResolver(verifySchema), defaultValues: { code: "" } });
  const [confirmation, setConfirmation] = useState(initial);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [lastSent, setLastSent] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [notice, setNotice] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const wait = Math.max(0, COOLDOWN - Math.floor((now - lastSent) / 1000));

  async function onSubmit(data: z.infer<typeof verifySchema>) {
    setNotice(null);
    try {
      const token = idToken ?? (await confirmSmsCode(confirmation, data.code));
      setIdToken(token);
      await onVerified(token);
    } catch (error) {
      if (error instanceof AuthError && error.status === 400) setIdToken(null); // stale proof: a new SMS is needed
      const onCode = error instanceof SmsError && (error.code === "invalid-code" || error.code === "code-expired");
      if (onCode) form.setError("code", { type: "server", message: errorMessage(error) }, { shouldFocus: true });
      else form.setError("root.server", { type: "server", message: errorMessage(error) });
    }
  }

  async function onResend() {
    form.clearErrors();
    setNotice(null);
    setResending(true);
    try {
      setConfirmation(await sendSmsCode(phone, recaptchaId));
      setIdToken(null);
      form.reset({ code: "" });
      setLastSent(Date.now());
      setNotice(copy.resent);
    } catch (error) {
      form.setError("root.server", { type: "server", message: errorMessage(error) });
    } finally {
      setResending(false);
    }
  }

  return (
    <Card className="w-full rounded-3xl [--card-spacing:--spacing(6)]">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-black text-ink">{copy.title}</CardTitle>
        <CardDescription className="text-base">{copy.lede(formatPhone(phone))}</CardDescription>
      </CardHeader>
      <CardContent>
        <form id="form-sms-code" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Controller
              name="code"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid} className="items-center">
                  <FieldLabel htmlFor="form-sms-code-input">{authCopy.fields.code}</FieldLabel>
                  <InputOTP
                    {...field}
                    id="form-sms-code-input"
                    maxLength={6}
                    pattern={REGEXP_ONLY_DIGITS}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    disabled={idToken !== null}
                    aria-invalid={fieldState.invalid}
                  >
                    <InputOTPGroup className="*:data-[slot=input-otp-slot]:size-11 *:data-[slot=input-otp-slot]:text-lg">
                      {Array.from({ length: 6 }, (_, index) => <InputOTPSlot key={index} index={index} aria-invalid={fieldState.invalid} />)}
                    </InputOTPGroup>
                  </InputOTP>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <FormAlert error={form.formState.errors.root?.server?.message} success={notice} />
          </FieldGroup>
        </form>
      </CardContent>
      <CardFooter className="flex-col gap-3">
        <Button type="submit" form="form-sms-code" size="lg" className="h-11 w-full rounded-full text-base font-semibold" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Spinner data-icon="inline-start" />}
          {copy.submit}
        </Button>
        <Field orientation="horizontal" className="justify-between">
          <Button type="button" variant="link" className="h-auto px-0" onClick={onResend} disabled={wait > 0 || resending}>
            {wait > 0 ? copy.resendIn(wait) : copy.resend}
          </Button>
          <Button type="button" variant="link" className="h-auto px-0 text-muted-foreground" onClick={onBack}>
            {copy.back}
          </Button>
        </Field>
      </CardFooter>
    </Card>
  );
}
