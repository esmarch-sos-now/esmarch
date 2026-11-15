import type { Metadata } from "next";
import AuthShell from "@/components/auth/auth-shell";
import ForgotPasswordForm from "@/components/auth/forgot-password-form";

export const metadata: Metadata = { title: "Quên mật khẩu – SOS NOW" };

export default async function Page({ searchParams }: PageProps<"/quen-mat-khau">) {
  const { phone } = await searchParams;
  return (
    <AuthShell>
      <ForgotPasswordForm initialPhone={typeof phone === "string" ? phone.slice(0, 20) : ""} />
    </AuthShell>
  );
}
