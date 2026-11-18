import { Suspense } from "react";
import type { Metadata } from "next";
import CourseQuizScreen from "@/components/site/courses/course-quiz-screen";

export const metadata: Metadata = { title: "Kiểm tra nhanh – SOS NOW" };

// A lesson's quiz (?khoa=<course>&bai=<lesson>), opened from the course page once the video has been watched.
// useSearchParams needs a Suspense boundary for static prerendering.
export default function Page() {
  return (
    <Suspense>
      <CourseQuizScreen />
    </Suspense>
  );
}
