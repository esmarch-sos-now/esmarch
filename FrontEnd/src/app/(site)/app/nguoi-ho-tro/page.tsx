import type { Metadata } from "next";
import RequesterScreen from "@/components/site/support/requester-screen";

export const metadata: Metadata = { title: "Tìm người hỗ trợ – SOS NOW" };

export default function Page() {
  return <RequesterScreen />;
}
