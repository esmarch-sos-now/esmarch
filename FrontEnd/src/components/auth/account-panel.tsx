"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { LogOut, MonitorSmartphone } from "lucide-react";
import type * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useChangePassword, useLogout, useSession, useUpdateProfile } from "@/hooks/use-auth";
import { authCopy } from "@/content/auth";
import type { User } from "@/lib/auth/client";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { changePasswordSchema, profileSchema } from "@/lib/auth/schemas";
import { FormAlert, reportError } from "./form-fields";

const copy = authCopy.account;
const { fields } = authCopy;
const submitClass = "h-11 rounded-full px-6 text-base font-semibold";

function ProfileCard({ user }: { user: User }) {
  const update = useUpdateProfile();
  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { displayName: user.displayName ?? "" },
  });
  const [saved, setSaved] = useState(false);

  async function onSubmit(data: z.infer<typeof profileSchema>) {
    setSaved(false);
    try {
      await update.trigger({ displayName: data.displayName || null });
      setSaved(true);
    } catch (error) {
      reportError(form.setError, error);
    }
  }

  return (
    <Card className="w-full rounded-3xl [--card-spacing:--spacing(6)]">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-ink">{copy.profile}</CardTitle>
      </CardHeader>
      <CardContent>
        <form id="form-profile" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Controller
              name="displayName"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="form-profile-name">{fields.name}</FieldLabel>
                  <Input {...field} id="form-profile-name" autoComplete="name" maxLength={100} aria-invalid={fieldState.invalid} />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <FormAlert error={form.formState.errors.root?.server?.message} success={saved ? copy.saved : null} />
          </FieldGroup>
        </form>
      </CardContent>
      <CardFooter>
        <Button type="submit" form="form-profile" size="lg" className={submitClass} disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Spinner data-icon="inline-start" />}
          {copy.save}
        </Button>
      </CardFooter>
    </Card>
  );
}

function PasswordCard() {
  const change = useChangePassword();
  const form = useForm<z.infer<typeof changePasswordSchema>>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", password: "", confirm: "" },
  });
  const [changed, setChanged] = useState(false);

  async function onSubmit(data: z.infer<typeof changePasswordSchema>) {
    setChanged(false);
    try {
      await change.trigger({ currentPassword: data.currentPassword, newPassword: data.password });
      form.reset();
      setChanged(true);
    } catch (error) {
      reportError(form.setError, error, { "Current password is incorrect.": "currentPassword" });
    }
  }

  return (
    <Card className="w-full rounded-3xl [--card-spacing:--spacing(6)]">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-ink">{copy.password}</CardTitle>
      </CardHeader>
      <CardContent>
        <form id="form-password" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Controller
              name="currentPassword"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="form-password-current">{fields.currentPassword}</FieldLabel>
                  <Input {...field} id="form-password-current" type="password" autoComplete="current-password" aria-invalid={fieldState.invalid} />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              name="password"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="form-password-new">{fields.newPassword}</FieldLabel>
                  <Input {...field} id="form-password-new" type="password" autoComplete="new-password" maxLength={128} aria-invalid={fieldState.invalid} />
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
                  <FieldLabel htmlFor="form-password-confirm">{fields.confirmPassword}</FieldLabel>
                  <Input {...field} id="form-password-confirm" type="password" autoComplete="new-password" aria-invalid={fieldState.invalid} />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <FormAlert error={form.formState.errors.root?.server?.message} success={changed ? copy.passwordChanged : null} />
          </FieldGroup>
        </form>
      </CardContent>
      <CardFooter>
        <Button type="submit" form="form-password" size="lg" className={submitClass} disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Spinner data-icon="inline-start" />}
          {copy.passwordSubmit}
        </Button>
      </CardFooter>
    </Card>
  );
}

function SessionsCard() {
  const router = useRouter();
  const logout = useLogout();
  const [which, setWhich] = useState<"one" | "all" | null>(null);

  async function signOut(everywhere: boolean) {
    setWhich(everywhere ? "all" : "one");
    try {
      await logout.trigger({ everywhere });
    } finally {
      router.replace(LOGIN_PATH);
      router.refresh();
    }
  }

  return (
    <Card className="w-full rounded-3xl [--card-spacing:--spacing(6)]">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-ink">{copy.sessions}</CardTitle>
      </CardHeader>
      <CardFooter className="flex-wrap gap-3">
        <Button size="lg" className={submitClass} onClick={() => signOut(false)} disabled={logout.isMutating}>
          {which === "one" ? <Spinner data-icon="inline-start" /> : <LogOut data-icon="inline-start" />}
          {copy.logout}
        </Button>
        <Button size="lg" variant="outline" className={submitClass} onClick={() => signOut(true)} disabled={logout.isMutating}>
          {which === "all" ? <Spinner data-icon="inline-start" /> : <MonitorSmartphone data-icon="inline-start" />}
          {copy.logoutAll}
        </Button>
      </CardFooter>
    </Card>
  );
}

export default function AccountPanel() {
  const { user } = useSession();
  if (!user) return null;
  const since = new Date(user.createdAt).toLocaleDateString("vi-VN");

  return (
    <>
      <Card className="w-full rounded-3xl [--card-spacing:--spacing(6)]">
        <CardHeader>
          <CardTitle className="text-3xl font-black text-ink">{copy.title}</CardTitle>
          <CardDescription className="text-base">
            {copy.signedInAs} <strong className="text-ink" data-testid="account-email">{user.email}</strong> · {copy.memberSince} {since}
          </CardDescription>
        </CardHeader>
      </Card>
      <ProfileCard user={user} />
      <PasswordCard />
      <SessionsCard />
    </>
  );
}
