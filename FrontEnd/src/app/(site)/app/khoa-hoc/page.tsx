import type { Metadata } from "next";
import CourseScreen from "@/components/site/courses/course-screen";

export const metadata: Metadata = { title: "Khóa học sơ cứu – SOS NOW" };

// The first-aid courses, step 1 of becoming a supporter: opened from the "Sẵn sàng hỗ trợ" page and leading back there.
export default function Page() {
  return <CourseScreen />;
}
