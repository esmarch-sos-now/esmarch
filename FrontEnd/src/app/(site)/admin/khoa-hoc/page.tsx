import type { Metadata } from "next";
import CoursesPanel from "@/components/admin/courses-panel";

export const metadata: Metadata = { title: "Khóa học – Quản trị SOS NOW" };

export default function Page() {
  return <CoursesPanel />;
}
