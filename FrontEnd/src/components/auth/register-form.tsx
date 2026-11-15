"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import type * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useRegister, useResendSignupCode, useVerifyPhone } from "@/hooks/use-auth";
import { authCopy } from "@/content/auth";
import { normalizePhone } from "@/lib/auth/phone";
import { registerSchema } from "@/lib/auth/schemas";
import { FormAlert, reportError, useRedirectIfSignedIn } from "./form-fields";
import PhoneInput from "./phone-input";
import SmsCodeStep from "./sms-code-step";

const copy = authCopy.register;
const { fields } = authCopy;

/** Step 1: name, phone number and password. Step 2: the texted code verifies the number and signs the user in. */
export default function RegisterForm({ next }: { next: string }) {
  const router = useRouter();
  const register = useRegister();
  const resend = useResendSignupCode();
  const verify = useVerifyPhone();
  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { displayName: "", phone: "", password: "", confirm: "" },
  });
  const [sentTo, setSentTo] = useState<string | null>(null);
  useRedirectIfSignedIn(next, sentTo === null && !form.formState.isSubmitting);

  async function onSubmit(data: z.infer<typeof registerSchema>) {
    const phone = normalizePhone(data.phone)!; // the schema already checked it
    try {
      const user = await register.trigger({ phone, password: data.password, displayName: data.displayName || undefined });
      if (user) router.replace(next); // the project signs in without phone confirmation
      else setSentTo(phone);
    } catch (error) {
      reportError(form.setError, error, {
        phone_exists: "phone",
        user_already_exists: "phone",
        validation_failed: "phone",
        weak_password: "password",
      });
    }
  }

  if (sentTo)
    return (
      <SmsCodeStep
        phone={sentTo}
        onVerify={async (code) => {
          await verify.trigger({ phone: sentTo, code });
          router.replace(next);
        }}
        onResend={() => resend.trigger({ phone: sentTo })}
        onBack={() => setSentTo(null)}
      />
    );

  return (
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
                  <PhoneInput {...field} id="form-register-phone" aria-invalid={fieldState.invalid} />
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
                  <Input {...field} id="form-register-password" type="password" autoComplete="new-password" maxLength={72} aria-invalid={fieldState.invalid} />
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
  );
}
