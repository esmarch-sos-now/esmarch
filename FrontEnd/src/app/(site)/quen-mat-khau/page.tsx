import type { Metadata } from "next";
import AuthShell from "@/components/auth/auth-shell";
import ForgotPasswordForm from "@/components/auth/forgot-password-form";

export const metadata: Metadata = { title: "Quên mật khẩu – SOS NOW" };

export default async function Page({ searchParams }: PageProps<"/quen-mat-khau">) {
  const { email } = await searchParams;
  return (
    <AuthShell>
      <ForgotPasswordForm initialEmail={typeof email === "string" ? email.slice(0, 254) : ""} />
    </AuthShell>
  );
}
