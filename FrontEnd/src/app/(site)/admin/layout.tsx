import type { Metadata } from "next";
import type { ReactNode } from "react";
import AdminForbidden from "@/components/admin/admin-forbidden";
import AdminShell from "@/components/admin/admin-shell";
import { SessionProvider } from "@/components/providers/auth-provider";
import { ADMIN_PATH } from "@/lib/auth/paths";
import { backendRole, requireUser } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Quản trị – SOS NOW", robots: { index: false } };

// The admin area has its own frame: no site navbar, only management. The proxy redirects visitors without a session
// and keeps ADMIN accounts in here; this asks the backend for the role (its database is the source of truth), and
// every /api/admin call is checked again by the backend.
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireUser(ADMIN_PATH);
  const role = await backendRole();
  return (
    <SessionProvider user={{ ...user, role }}>
      {role === "ADMIN" ? <AdminShell>{children}</AdminShell> : <AdminForbidden />}
    </SessionProvider>
  );
}
