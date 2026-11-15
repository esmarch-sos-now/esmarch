"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import type * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useLogin, useResendSignupCode, useVerifyPhone } from "@/hooks/use-auth";
import { authCopy } from "@/content/auth";
import { normalizePhone } from "@/lib/auth/phone";
import { loginSchema } from "@/lib/auth/schemas";
import { FormAlert, isUnverified, reportError, useRedirectIfSignedIn } from "./form-fields";
import PhoneInput from "./phone-input";
import SmsCodeStep from "./sms-code-step";

const copy = authCopy.login;

export default function LoginForm({ next, notice }: { next: string; notice?: string }) {
  const router = useRouter();
  const login = useLogin();
  const resend = useResendSignupCode();
  const verify = useVerifyPhone();
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { phone: "", password: "" },
  });
  // A number that was never confirmed gets the SMS step first; the code signs the user in.
  const [unconfirmed, setUnconfirmed] = useState<string | null>(null);
  const phoneInput = useWatch({ control: form.control, name: "phone" });
  useRedirectIfSignedIn(next, !form.formState.isSubmitting && !form.formState.isSubmitSuccessful && unconfirmed === null);

  async function onSubmit(data: z.infer<typeof loginSchema>) {
    const phone = normalizePhone(data.phone)!; // the schema already checked it
    try {
      await login.trigger({ phone, password: data.password });
      router.replace(next);
    } catch (error) {
      if (!isUnverified(error)) return reportError(form.setError, error, { invalid_credentials: "password" });
      await resend.trigger({ phone }).catch(() => undefined);
      setUnconfirmed(phone);
    }
  }

  if (unconfirmed)
    return (
      <SmsCodeStep
        phone={unconfirmed}
        onVerify={async (code) => {
          await verify.trigger({ phone: unconfirmed, code });
          router.replace(next);
        }}
        onResend={() => resend.trigger({ phone: unconfirmed })}
        onBack={() => setUnconfirmed(null)}
      />
    );

  return (
    // Không có thẻ bao quanh: form nằm thẳng trên nền trang
    <Card className="w-full overflow-visible rounded-none bg-transparent py-0 ring-0 [--card-spacing:--spacing(6)]">
      <CardHeader className="px-0">
        <CardTitle className="text-3xl font-black text-ink">{copy.title}</CardTitle>
        <CardDescription className="text-base">{copy.lede}</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <form id="form-login" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <FormAlert success={notice} />
            <Controller
              name="phone"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="form-login-phone">{authCopy.fields.phone}</FieldLabel>
                  <PhoneInput {...field} id="form-login-phone" aria-invalid={fieldState.invalid} />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              name="password"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <div className="flex items-center justify-between">
                    <FieldLabel htmlFor="form-login-password">{authCopy.fields.password}</FieldLabel>
                    <Link className="text-sm font-medium text-brand hover:underline" href={`/quen-mat-khau?phone=${encodeURIComponent(phoneInput)}`}>
                      {copy.forgot}
                    </Link>
                  </div>
                  <Input {...field} id="form-login-password" type="password" autoComplete="current-password" aria-invalid={fieldState.invalid} />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <FormAlert error={form.formState.errors.root?.server?.message} />
          </FieldGroup>
        </form>
      </CardContent>
      <CardFooter className="flex-col gap-4 rounded-none border-t-0 bg-transparent px-0">
        <Button type="submit" form="form-login" size="lg" className="h-11 w-full rounded-full text-base font-semibold" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Spinner data-icon="inline-start" />}
          {copy.submit}
        </Button>
        <p className="text-sm text-muted-foreground">
          {copy.noAccount}{" "}
          <Link className="font-medium text-brand hover:underline" href={`/dang-ky?next=${encodeURIComponent(next)}`}>{copy.toRegister}</Link>
        </p>
      </CardFooter>
    </Card>
  );
}
