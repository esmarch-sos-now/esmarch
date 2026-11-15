import type { Metadata } from "next";
import UsersPanel from "@/components/admin/users-panel";

export const metadata: Metadata = { title: "Người dùng – Quản trị SOS NOW" };

export default function Page() {
  return <UsersPanel />;
}
