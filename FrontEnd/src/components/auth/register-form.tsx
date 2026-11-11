"use client";

import { useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import type * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useRegister } from "@/hooks/use-auth";
import { authCopy } from "@/content/auth";
import { registerSchema } from "@/lib/auth/schemas";
import { FormAlert, reportError, useRedirectIfSignedIn } from "./form-fields";
import VerifyEmail from "./verify-email";

const copy = authCopy.register;
const { fields } = authCopy;

export default function RegisterForm({ next }: { next: string }) {
  const register = useRegister();
  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { displayName: "", email: "", password: "", confirm: "" },
  });
  const [sent, setSent] = useState<string | null>(null);
  useRedirectIfSignedIn(next, sent === null);

  async function onSubmit(data: z.infer<typeof registerSchema>) {
    try {
      await register.trigger({ email: data.email, password: data.password, displayName: data.displayName || undefined });
      setSent(data.email);
    } catch (error) {
      reportError(form.setError, error, { "Invalid email address.": "email" });
    }
  }

  if (sent) return <VerifyEmail email={sent} next={next} onBack={() => setSent(null)} />;

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
              name="email"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="form-register-email">{fields.email}</FieldLabel>
                  <Input {...field} id="form-register-email" type="email" autoComplete="email" maxLength={254} aria-invalid={fieldState.invalid} />
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
  );
}
