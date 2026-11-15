import type { Metadata } from "next";
import RespondersPanel from "@/components/admin/responders-panel";

export const metadata: Metadata = { title: "Người hỗ trợ – Quản trị SOS NOW" };

export default function Page() {
  return <RespondersPanel />;
}
