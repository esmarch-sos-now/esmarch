import type { Metadata } from "next";
import AuthShell from "@/components/auth/auth-shell";
import LoginForm from "@/components/auth/login-form";
import { authCopy } from "@/content/auth";
import { safeNext } from "@/lib/auth/paths";

export const metadata: Metadata = { title: "Đăng nhập – SOS NOW" };

export default async function Page({ searchParams }: PageProps<"/dang-nhap">) {
  const { next, reset } = await searchParams;
  return (
    <AuthShell>
      <LoginForm next={safeNext(next)} notice={reset ? authCopy.login.resetDone : undefined} />
    </AuthShell>
  );
}
