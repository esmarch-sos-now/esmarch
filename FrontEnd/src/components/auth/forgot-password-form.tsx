"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import type * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Spinner } from "@/components/ui/spinner";
import { useForgotPassword, useResetPassword } from "@/hooks/use-auth";
import { authCopy } from "@/content/auth";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { forgotSchema, resetSchema } from "@/lib/auth/schemas";
import { FormAlert, reportError } from "./form-fields";

const copy = authCopy.forgot;
const { fields } = authCopy;
const submitClass = "h-11 w-full rounded-full text-base font-semibold";

/** Step 1: ask for a reset code. Step 2: enter it with the new password. */
export default function ForgotPasswordForm({ initialEmail }: { initialEmail: string }) {
  const [email, setEmail] = useState<string | null>(null);
  return email === null ? <RequestCode initialEmail={initialEmail} onSent={setEmail} /> : <ResetWithCode email={email} onBack={() => setEmail(null)} />;
}

function RequestCode({ initialEmail, onSent }: { initialEmail: string; onSent: (email: string) => void }) {
  const forgot = useForgotPassword();
  const form = useForm<z.infer<typeof forgotSchema>>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: initialEmail },
  });

  async function onSubmit(data: z.infer<typeof forgotSchema>) {
    try {
      await forgot.trigger({ email: data.email });
      onSent(data.email);
    } catch (error) {
      reportError(form.setError, error, { "Invalid email address.": "email" });
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
              name="email"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="form-forgot-email">{fields.email}</FieldLabel>
                  <Input {...field} id="form-forgot-email" type="email" autoComplete="email" aria-invalid={fieldState.invalid} />
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

function ResetWithCode({ email, onBack }: { email: string; onBack: () => void }) {
  const router = useRouter();
  const reset = useResetPassword();
  const form = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
    defaultValues: { code: "", password: "", confirm: "" },
  });

  async function onSubmit(data: z.infer<typeof resetSchema>) {
    try {
      await reset.trigger({ email, code: data.code, newPassword: data.password });
      router.replace(`${LOGIN_PATH}?reset=1`);
    } catch (error) {
      reportError(form.setError, error, { "Invalid or expired code.": "code" });
    }
  }

  return (
    <Card className="w-full rounded-3xl [--card-spacing:--spacing(6)]">
      <CardHeader>
        <CardTitle className="text-3xl font-black text-ink">{copy.title}</CardTitle>
        <CardDescription className="text-base">{copy.resetLede(email)}</CardDescription>
      </CardHeader>
      <CardContent>
        <form id="form-reset" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Controller
              name="code"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="form-reset-code">{fields.code}</FieldLabel>
                  <InputOTP
                    {...field}
                    id="form-reset-code"
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
            <Controller
              name="password"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="form-reset-password">{fields.newPassword}</FieldLabel>
                  <Input {...field} id="form-reset-password" type="password" autoComplete="new-password" maxLength={128} aria-invalid={fieldState.invalid} />
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
        <Button type="submit" form="form-reset" size="lg" className={submitClass} disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Spinner data-icon="inline-start" />}
          {copy.resetSubmit}
        </Button>
        <Button type="button" variant="link" className="h-auto px-0 text-muted-foreground" onClick={onBack}>{authCopy.verify.back}</Button>
      </CardFooter>
    </Card>
  );
}
