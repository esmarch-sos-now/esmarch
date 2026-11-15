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
import { useLogout, useSendResetCode, useSetNewPassword, useVerifyPhone } from "@/hooks/use-auth";
import { authCopy } from "@/content/auth";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { formatPhone, normalizePhone } from "@/lib/auth/phone";
import { forgotSchema, newPasswordSchema } from "@/lib/auth/schemas";
import { FormAlert, reportError } from "./form-fields";
import PhoneInput from "./phone-input";
import SmsCodeStep from "./sms-code-step";

const copy = authCopy.forgot;
const { fields } = authCopy;
const submitClass = "h-11 w-full rounded-full text-base font-semibold";

type Step = { name: "phone" } | { name: "code"; phone: string } | { name: "password"; phone: string };

/** Step 1: the account's phone number. Step 2: the texted code verifies it. Step 3: choose a new password. */
export default function ForgotPasswordForm({ initialPhone }: { initialPhone: string }) {
  const [step, setStep] = useState<Step>({ name: "phone" });
  const sendCode = useSendResetCode();
  const verify = useVerifyPhone();
  const logout = useLogout();

  if (step.name === "code")
    return (
      <SmsCodeStep
        phone={step.phone}
        onVerify={async (code) => {
          await verify.trigger({ phone: step.phone, code });
          setStep({ name: "password", phone: step.phone });
        }}
        onResend={() => sendCode.trigger({ phone: step.phone })}
        onBack={() => setStep({ name: "phone" })}
      />
    );
  if (step.name === "password")
    return (
      <NewPassword
        phone={step.phone}
        onBack={async () => {
          await logout.trigger({ everywhere: false }).catch(() => undefined); // the code signed the user in
          setStep({ name: "phone" });
        }}
      />
    );
  return <RequestCode initialPhone={initialPhone} onSent={(phone) => setStep({ name: "code", phone })} />;
}

function RequestCode({ initialPhone, onSent }: { initialPhone: string; onSent: (phone: string) => void }) {
  const sendCode = useSendResetCode();
  const form = useForm<z.infer<typeof forgotSchema>>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { phone: initialPhone },
  });

  async function onSubmit(data: z.infer<typeof forgotSchema>) {
    const phone = normalizePhone(data.phone)!; // the schema already checked it
    try {
      await sendCode.trigger({ phone });
      onSent(phone);
    } catch (error) {
      reportError(form.setError, error, { otp_disabled: "phone", validation_failed: "phone" });
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
                  <PhoneInput {...field} id="form-forgot-phone" aria-invalid={fieldState.invalid} />
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

function NewPassword({ phone, onBack }: { phone: string; onBack: () => void }) {
  const router = useRouter();
  const setPassword = useSetNewPassword();
  const form = useForm<z.infer<typeof newPasswordSchema>>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: "", confirm: "" },
  });

  async function onSubmit(data: z.infer<typeof newPasswordSchema>) {
    try {
      await setPassword.trigger({ newPassword: data.password });
      router.replace(`${LOGIN_PATH}?reset=1`);
    } catch (error) {
      reportError(form.setError, error, { weak_password: "password", same_password: "password" });
    }
  }

  return (
    <Card className="w-full rounded-3xl [--card-spacing:--spacing(6)]">
      <CardHeader>
        <CardTitle className="text-3xl font-black text-ink">{copy.newPasswordTitle}</CardTitle>
        <CardDescription className="text-base">{copy.newPasswordLede(formatPhone(phone))}</CardDescription>
      </CardHeader>
      <CardContent>
        <form id="form-new-password" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Controller
              name="password"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="form-new-password-input">{fields.newPassword}</FieldLabel>
                  <Input {...field} id="form-new-password-input" type="password" autoComplete="new-password" maxLength={72} autoFocus aria-invalid={fieldState.invalid} />
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
                  <FieldLabel htmlFor="form-new-password-confirm">{fields.confirmPassword}</FieldLabel>
                  <Input {...field} id="form-new-password-confirm" type="password" autoComplete="new-password" aria-invalid={fieldState.invalid} />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <FormAlert error={form.formState.errors.root?.server?.message} />
          </FieldGroup>
        </form>
      </CardContent>
      <CardFooter className="flex-col gap-3">
        <Button type="submit" form="form-new-password" size="lg" className={submitClass} disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Spinner data-icon="inline-start" />}
          {copy.resetSubmit}
        </Button>
        <Button type="button" variant="link" className="h-auto px-0 text-muted-foreground" onClick={onBack}>
          {authCopy.sms.back}
        </Button>
      </CardFooter>
    </Card>
  );
}
