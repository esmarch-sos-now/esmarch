import type { Metadata } from "next";
import CourseScreen from "@/components/site/courses/course-screen";

export const metadata: Metadata = { title: "Khóa học sơ cứu – SOS NOW" };

export default function Page() {
  return <CourseScreen />;
}
