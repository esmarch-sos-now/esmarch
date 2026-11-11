"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import type * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Spinner } from "@/components/ui/spinner";
import { useResendVerification, useVerifyEmail } from "@/hooks/use-auth";
import { authCopy } from "@/content/auth";
import { verifySchema } from "@/lib/auth/schemas";
import { FormAlert, errorMessage, reportError } from "./form-fields";

const COOLDOWN = 60;
const copy = authCopy.verify;

/** Step 2 of sign-up (and of signing in to an unverified account): enter the mailed code. */
/** Mounted right after a code was sent, so the resend cooldown starts now. */
export default function VerifyEmail({ email, next, onBack }: { email: string; next: string; onBack: () => void }) {
  const router = useRouter();
  const verify = useVerifyEmail();
  const resend = useResendVerification();
  const form = useForm<z.infer<typeof verifySchema>>({
    resolver: zodResolver(verifySchema),
    defaultValues: { code: "" },
  });
  const [lastSent, setLastSent] = useState(() => Date.now());
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const wait = Math.max(0, COOLDOWN - Math.floor((now - lastSent) / 1000));

  async function onSubmit(data: z.infer<typeof verifySchema>) {
    setNotice(null);
    try {
      await verify.trigger({ email, code: data.code });
      router.replace(next);
    } catch (error) {
      reportError(form.setError, error, { "Invalid or expired code.": "code" });
    }
  }

  async function onResend() {
    form.clearErrors();
    try {
      await resend.trigger({ email });
      setLastSent(Date.now());
      setNotice(copy.resent);
    } catch (error) {
      form.setError("root.server", { message: errorMessage(error) });
    }
  }

  return (
    <Card className="w-full rounded-3xl [--card-spacing:--spacing(6)]">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-black text-ink">{copy.title}</CardTitle>
        <CardDescription className="text-base">{copy.lede(email)}</CardDescription>
      </CardHeader>
      <CardContent>
        <form id="form-verify-email" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Controller
              name="code"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid} className="items-center">
                  <FieldLabel htmlFor="form-verify-email-code">{authCopy.fields.code}</FieldLabel>
                  <InputOTP
                    {...field}
                    id="form-verify-email-code"
                    maxLength={6}
                    pattern={REGEXP_ONLY_DIGITS}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
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
        <Button type="submit" form="form-verify-email" size="lg" className="h-11 w-full rounded-full text-base font-semibold" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Spinner data-icon="inline-start" />}
          {copy.submit}
        </Button>
        <Field orientation="horizontal" className="justify-between">
          <Button type="button" variant="link" className="h-auto px-0" onClick={onResend} disabled={wait > 0 || resend.isMutating}>
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
