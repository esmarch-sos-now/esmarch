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
import { useLogin, useResendVerification } from "@/hooks/use-auth";
import { authCopy } from "@/content/auth";
import { loginSchema } from "@/lib/auth/schemas";
import { FormAlert, isUnverified, reportError, useRedirectIfSignedIn } from "./form-fields";
import VerifyEmail from "./verify-email";

const copy = authCopy.login;

export default function LoginForm({ next, notice }: { next: string; notice?: string }) {
  const router = useRouter();
  const login = useLogin();
  const resend = useResendVerification();
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  // An unverified account signs in through the code step instead.
  const [verify, setVerify] = useState<string | null>(null);
  const email = useWatch({ control: form.control, name: "email" });
  useRedirectIfSignedIn(next, !form.formState.isSubmitting && !form.formState.isSubmitSuccessful);

  async function onSubmit(data: z.infer<typeof loginSchema>) {
    try {
      await login.trigger(data);
      router.replace(next);
    } catch (error) {
      if (!isUnverified(error)) return reportError(form.setError, error, {}, "login");
      await resend.trigger({ email: data.email }).catch(() => undefined);
      setVerify(data.email);
    }
  }

  if (verify) return <VerifyEmail email={verify} next={next} onBack={() => setVerify(null)} />;

  return (
    <Card className="w-full rounded-3xl [--card-spacing:--spacing(6)]">
      <CardHeader>
        <CardTitle className="text-3xl font-black text-ink">{copy.title}</CardTitle>
        <CardDescription className="text-base">{copy.lede}</CardDescription>
      </CardHeader>
      <CardContent>
        <form id="form-login" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <FormAlert success={notice} />
            <Controller
              name="email"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="form-login-email">{authCopy.fields.email}</FieldLabel>
                  <Input {...field} id="form-login-email" type="email" autoComplete="email" aria-invalid={fieldState.invalid} />
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
                    <Link className="text-sm font-medium text-brand hover:underline" href={`/quen-mat-khau?email=${encodeURIComponent(email)}`}>
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
      <CardFooter className="flex-col gap-4">
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
