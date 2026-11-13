import type { Metadata } from "next";
import AuthShell from "@/components/auth/auth-shell";
import ForgotPasswordForm from "@/components/auth/forgot-password-form";

export const metadata: Metadata = { title: "Quên mật khẩu – SOS NOW" };

// The phone number is not taken from the URL: it would end up in browser history and server logs.
export default function Page() {
  return (
    <AuthShell>
      <ForgotPasswordForm />
    </AuthShell>
  );
}
