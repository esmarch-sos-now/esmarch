"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, LogIn, PlayCircle } from "lucide-react";
import {
  Celebration,
  courseHref,
  type Finished,
  lessonHref,
  QuizPanel,
  useCourses,
} from "@/components/site/courses/course-learning";
import AppNav from "@/components/site/app-nav";
import { Page } from "@/components/site/primitives";
import { Button } from "@/components/ui/button";
import { courseCopy } from "@/content/app";
import { useSession } from "@/hooks/use-auth";
import { useSupporterProfile } from "@/hooks/use-supporter";
import { COURSES_PATH, QUIZ_PATH, SUPPORTER_PATH } from "@/lib/auth/paths";

// A lesson's quiz on its own page (/app/khoa-hoc/kiem-tra?khoa=<course>&bai=<lesson>), reached by "Làm bài kiểm tra"
// once the lesson's video has been watched (the server says so; until then this page sends the learner back to the
// video). Passing leads on to the next lesson, or to the congratulations when it finishes the course; failing too often
// leads back to the video, which the server has reset.
export default function CourseQuizScreen() {
  const c = courseCopy;
  const params = useSearchParams();
  const router = useRouter();
  const { status } = useSession();
  const supporter = useSupporterProfile();
  const { overview, courses, applyCourse } = useCourses();
  const [finished, setFinished] = useState<Finished | null>(null);

  const courseId = params.get("khoa") ?? "";
  const lessonId = params.get("bai") ?? "";
  const course = courses.find((item) => item.id === courseId);
  const index = course?.lessons.findIndex((item) => item.id === lessonId) ?? -1;
  const lesson = index >= 0 ? course?.lessons[index] : undefined;
  const next = index >= 0 ? course?.lessons[index + 1] : undefined;
  const backLabel = supporter.data?.status === "verified" ? c.backToSupport : c.backToSignup;
  const loginHref = `/dang-nhap?next=${encodeURIComponent(`${QUIZ_PATH}?${params.toString()}`)}`;

  return (
    <Page>
      <AppNav />
      <main className="mx-auto w-full max-w-180 px-4 pt-7 pb-12">
        <Link
          href={lesson ? lessonHref(courseId, lessonId) : COURSES_PATH}
          className="inline-flex items-center gap-1.5 rounded-full text-sm font-semibold text-muted-foreground hover:text-brand [&_svg]:size-4"
        >
          <ArrowLeft aria-hidden="true" /> {lesson ? c.backToLesson : c.backToCourses}
        </Link>
        {course && <p className="mt-3 text-xs font-bold tracking-[.12em] text-brand uppercase">{course.title}</p>}
        <h1 className="mt-1 text-[clamp(26px,3.6vw,36px)] leading-[1.2] font-black tracking-[-.01em] text-ink">
          {lesson ? c.quizFor(lesson.title) : c.quizTitle}
        </h1>

        {(status === "loading" || overview.isLoading) && <p className="mt-6 text-sm text-muted-foreground">{c.loading}</p>}

        {status === "unauthenticated" && (
          <section className="mt-6">
            <p className="text-[15px] text-ink">{c.signIn}</p>
            <Button asChild className="mt-4 h-11 rounded-full px-5 font-bold [&_svg]:size-4.5">
              <Link href={loginHref}>
                <LogIn aria-hidden="true" /> {c.signInButton}
              </Link>
            </Button>
          </section>
        )}

        {overview.error && (
          <section className="mt-6">
            <p className="text-[15px] text-ink">{c.loadFailed}</p>
            <Button variant="outline" onClick={() => void overview.mutate()} className="mt-4 rounded-full">{c.retryLoad}</Button>
          </section>
        )}

        {overview.data && !lesson && <p className="mt-6 text-[15px] text-ink">{c.lessonNotFound}</p>}

        {/* Not watched yet (a bookmark, or the video was reset): back to the video */}
        {course && lesson && !lesson.watched && (
          <section className="mt-6">
            <p className="text-[15px] text-ink">{c.quizNeedsVideo}</p>
            <Button asChild className="mt-4 h-11 rounded-full px-5 font-bold [&_svg]:size-4.5">
              <Link href={lessonHref(course.id, lesson.id)}>
                <PlayCircle aria-hidden="true" /> {c.backToLesson}
              </Link>
            </Button>
          </section>
        )}

        {course && lesson && lesson.watched && (
          <QuizPanel
            courseId={course.id}
            lesson={lesson}
            onCourseUpdated={(updated) => {
              const done = applyCourse(updated);
              if (done) setFinished(done);
            }}
            onPassed={() => {}}
            onRewatch={(updated) => {
              applyCourse(updated);
              router.push(lessonHref(course.id, lesson.id, true));
            }}
            onStale={() => void overview.mutate()}
            nextLesson={next}
            onNext={next ? () => router.push(lessonHref(course.id, next.id)) : undefined}
            recordedBadge={course.completed ? course.badge : undefined}
          />
        )}

        {finished && (
          <Celebration
            course={finished.course}
            allDone={finished.remaining === 0}
            remaining={finished.remaining}
            backHref={SUPPORTER_PATH}
            backLabel={backLabel}
            onNextCourse={() => {
              const nextCourse = courses.find((item) => item.id !== finished.course.id && !item.completed);
              router.push(nextCourse ? courseHref(nextCourse.id) : COURSES_PATH);
            }}
            onClose={() => setFinished(null)}
          />
        )}
      </main>
    </Page>
  );
}
