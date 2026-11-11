import type { Metadata } from "next";
import ResponderScreen from "@/components/site/support/responder-screen";

export const metadata: Metadata = { title: "Sẵn sàng hỗ trợ – SOS NOW" };

export default function Page() {
  return <ResponderScreen />;
}
