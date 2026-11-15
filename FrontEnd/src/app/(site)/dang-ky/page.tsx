import type { Metadata } from "next";
import AuthShell from "@/components/auth/auth-shell";
import RegisterForm from "@/components/auth/register-form";
import { safeNext } from "@/lib/auth/paths";

export const metadata: Metadata = { title: "Đăng ký – SOS NOW" };

export default async function Page({ searchParams }: PageProps<"/dang-ky">) {
  const { next } = await searchParams;
  return (
    <AuthShell bare>
      <RegisterForm next={safeNext(next)} />
    </AuthShell>
  );
}
