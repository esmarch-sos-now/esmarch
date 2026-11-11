import type { Metadata } from "next";
import AccountPanel from "@/components/auth/account-panel";
import AuthShell from "@/components/auth/auth-shell";
import { SessionProvider } from "@/components/providers/auth-provider";
import { ACCOUNT_PATH } from "@/lib/auth/paths";
import { requireUser } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Tài khoản – SOS NOW" };

// The proxy already redirects visitors without a session; requireUser also covers a revoked or expired one.
export default async function Page() {
  const user = await requireUser(ACCOUNT_PATH);
  return (
    <AuthShell wide>
      <SessionProvider user={user}>
        <AccountPanel />
      </SessionProvider>
    </AuthShell>
  );
}
