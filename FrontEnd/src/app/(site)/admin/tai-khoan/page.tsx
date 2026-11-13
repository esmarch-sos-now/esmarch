import type { Metadata } from "next";
import AccountPanel from "@/components/auth/account-panel";

export const metadata: Metadata = { title: "Tài khoản – Quản trị SOS NOW" };

// The admin's own profile, password and sessions (the user-facing /tai-khoan is out of reach for admin accounts).
export default function Page() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <AccountPanel />
    </div>
  );
}
