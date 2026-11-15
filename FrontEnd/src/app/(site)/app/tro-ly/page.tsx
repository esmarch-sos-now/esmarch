import type { Metadata } from "next";
import Assistant from "@/components/assistant/assistant";

export const metadata: Metadata = { title: "Trợ lý sơ cứu bằng giọng nói – SOS NOW" };

export default function Page() {
  return <Assistant />;
}
