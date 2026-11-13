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
import { usePhoneRegister } from "@/hooks/use-auth";
import { authCopy } from "@/content/auth";
import { sendSmsCode } from "@/lib/auth/firebase";
import { normalizePhone, registerSchema } from "@/lib/auth/schemas";
import { FormAlert, reportError, useRedirectIfSignedIn } from "./form-fields";
import SmsCodeStep from "./sms-code-step";

const copy = authCopy.register;
const { fields } = authCopy;
const RECAPTCHA_ID = "register-recaptcha";

type Pending = { phone: string; password: string; displayName?: string; confirmation: ConfirmationResult };

/** Step 1: name, phone and password, then an SMS code is sent. Step 2: enter the code; the account is created. */
export default function RegisterForm({ next }: { next: string }) {
  const router = useRouter();
  const register = usePhoneRegister();
  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { displayName: "", phone: "", password: "", confirm: "" },
  });
  const [pending, setPending] = useState<Pending | null>(null);
  useRedirectIfSignedIn(next, pending === null);

  async function onSubmit(data: z.infer<typeof registerSchema>) {
    const phone = normalizePhone(data.phone);
    if (!phone) return;
    try {
      const confirmation = await sendSmsCode(phone, RECAPTCHA_ID);
      setPending({ phone, password: data.password, displayName: data.displayName || undefined, confirmation });
    } catch (error) {
      reportError(form.setError, error);
    }
  }

  async function onVerified(idToken: string) {
    if (!pending) return;
    await register.trigger({ idToken, password: pending.password, displayName: pending.displayName });
    router.replace(next);
  }

  return (
    <>
      {/* Invisible reCAPTCHA for Firebase; kept mounted across both steps so "resend" can reuse it. */}
      <div id={RECAPTCHA_ID} />
      {pending ? (
        <SmsCodeStep
          phone={pending.phone}
          confirmation={pending.confirmation}
          recaptchaId={RECAPTCHA_ID}
          onVerified={onVerified}
          onBack={() => setPending(null)}
        />
      ) : (
        <Card className="w-full rounded-3xl [--card-spacing:--spacing(6)]">
          <CardHeader>
            <CardTitle className="text-3xl font-black text-ink">{copy.title}</CardTitle>
            <CardDescription className="text-base">{copy.lede}</CardDescription>
          </CardHeader>
          <CardContent>
            <form id="form-register" onSubmit={form.handleSubmit(onSubmit)} noValidate>
              <FieldGroup>
                <Controller
                  name="displayName"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="form-register-name">{fields.name}</FieldLabel>
                      <Input {...field} id="form-register-name" autoComplete="name" maxLength={100} aria-invalid={fieldState.invalid} />
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
                <Controller
                  name="phone"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="form-register-phone">{fields.phone}</FieldLabel>
                      <Input
                        {...field}
                        id="form-register-phone"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel-national"
                        placeholder="0912 345 678"
                        maxLength={20}
                        aria-invalid={fieldState.invalid}
                      />
                      <FieldDescription>{authCopy.hints.phone}</FieldDescription>
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
                <Controller
                  name="password"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="form-register-password">{fields.password}</FieldLabel>
                      <Input {...field} id="form-register-password" type="password" autoComplete="new-password" maxLength={128} aria-invalid={fieldState.invalid} />
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
                      <FieldLabel htmlFor="form-register-confirm">{fields.confirmPassword}</FieldLabel>
                      <Input {...field} id="form-register-confirm" type="password" autoComplete="new-password" aria-invalid={fieldState.invalid} />
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
                <FormAlert error={form.formState.errors.root?.server?.message} />
              </FieldGroup>
            </form>
          </CardContent>
          <CardFooter className="flex-col gap-4">
            <Button type="submit" form="form-register" size="lg" className="h-11 w-full rounded-full text-base font-semibold" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Spinner data-icon="inline-start" />}
              {copy.submit}
            </Button>
            <p className="text-sm text-muted-foreground">
              {copy.haveAccount}{" "}
              <Link className="font-medium text-brand hover:underline" href={`/dang-nhap?next=${encodeURIComponent(next)}`}>{copy.toLogin}</Link>
            </p>
          </CardFooter>
        </Card>
      )}
    </>
  );
}
