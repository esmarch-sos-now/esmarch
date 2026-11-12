"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ArrowRight, BookOpenCheck, CheckCircle2, Clock3, LockKeyhole, RotateCcw, ShieldCheck } from "lucide-react";
import Navbar from "@/components/site/landing/Navbar";
import { Page } from "@/components/site/primitives";
import { Button } from "@/components/ui/button";
import { appNav, courseCopy } from "@/content/app";
import { useAuthFetch, useSession } from "@/hooks/use-auth";
import { loginUrl } from "@/lib/auth/paths";
import type { Course, CourseLesson, CourseOverview, QuizResult } from "@/lib/courses/types";
import { cn } from "@/lib/utils";

type Profile = { enrolled: boolean; selfEnrollEnabled: boolean; displayName?: string };

const LOGIN_NEXT = loginUrl("/app/khoa-hoc");
const RESPONDER_PATH = "/app/san-sang-ho-tro";

// Khóa học sơ cứu: chỉ tài khoản đã đăng ký làm người hỗ trợ mới thấy nội dung. Người chưa đăng ký thấy thẻ khóa
// kèm lối sang trang "Sẵn sàng hỗ trợ"; máy chủ cũng trả 403 nên nội dung không lộ khi gọi thẳng API.
export default function CourseScreen() {
  const c = courseCopy;
  const { user, status: sessionStatus } = useSession();
  const authFetch = useAuthFetch();
  const profile = useSWR<Profile>(user ? "support-profile" : null, async () => {
    const response = await authFetch("/api/support/me");
    if (!response.ok) throw new Error(String(response.status));
    return (await response.json()) as Profile;
  });
  const enrolled = profile.data?.enrolled === true;
  const overview = useSWR<CourseOverview>(user && enrolled ? `courses:${user.id}` : null, async () => {
    const response = await authFetch("/api/courses");
    if (!response.ok) throw new Error(String(response.status));
    return (await response.json()) as CourseOverview;
  });
  const course = overview.data?.courses[0];
  const [activeId, setActiveId] = useState<string | null>(null);

  return (
    <Page>
      <Navbar appLinks={appNav} />
      <main className="mx-auto w-full max-w-200 px-4 pt-8 pb-16">
        <p className="text-xs font-bold tracking-[.14em] text-brand uppercase">{c.eyebrow}</p>
        <h1 className="mt-1.5 text-[clamp(28px,4vw,40px)] leading-[1.15] font-black text-ink">{c.title}</h1>
        <p className="mt-2 max-w-160 text-[16px] leading-[1.6] text-muted-foreground">{c.subtitle}</p>

        {sessionStatus === "loading" && <p className="mt-8 text-sm text-muted-foreground">{c.loading}</p>}

        {sessionStatus === "unauthenticated" && (
          <section className="mt-7 rounded-2xl border border-line bg-white p-6 text-center">
            <LockKeyhole aria-hidden="true" className="mx-auto size-8 text-brand" />
            <p className="mt-3 text-[15px] text-ink">{c.signIn}</p>
            <Button asChild className="mt-4 rounded-full font-bold">
              <Link href={LOGIN_NEXT}>{c.signInButton}</Link>
            </Button>
          </section>
        )}

        {user && profile.isLoading && <p className="mt-8 text-sm text-muted-foreground">{c.loading}</p>}

        {user && profile.error && (
          <section className="mt-7 rounded-2xl border border-line bg-white p-6">
            <p className="text-[15px] text-ink">{c.loadFailed}</p>
            <Button variant="outline" onClick={() => void profile.mutate()} className="mt-4 rounded-full">{c.retryLoad}</Button>
          </section>
        )}

        {user && profile.data && !enrolled && <Locked />}

        {user && enrolled && overview.isLoading && <p className="mt-8 text-sm text-muted-foreground">{c.loading}</p>}

        {user && enrolled && overview.error && (
          <section className="mt-7 rounded-2xl border border-line bg-white p-6">
            <p className="text-[15px] text-ink">{overview.error.message === "403" ? c.lockedNotice : c.loadFailed}</p>
            {overview.error.message === "403" ? (
              <Button asChild className="mt-4 rounded-full font-bold"><Link href={RESPONDER_PATH}>{c.lockedAction}</Link></Button>
            ) : (
              <Button variant="outline" onClick={() => void overview.mutate()} className="mt-4 rounded-full">{c.retryLoad}</Button>
            )}
          </section>
        )}

        {course && <CourseBody course={course} responderName={overview.data?.responderName ?? ""} activeId={activeId} onSelect={setActiveId} onPassed={() => void overview.mutate()} />}
      </main>
    </Page>
  );
}

function Locked() {
  const c = courseCopy;
  return (
    <section className="mt-7 rounded-2xl border-2 border-brand bg-white p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-soft text-brand" aria-hidden="true">
          <LockKeyhole className="size-5" />
        </span>
        <div>
          <h2 className="text-xl font-black text-ink">{c.lockedTitle}</h2>
          <p className="mt-1.5 text-[15px] leading-[1.6] text-muted-foreground">{c.lockedBody}</p>
        </div>
      </div>
      <Button asChild className="mt-5 h-11 rounded-full font-bold">
        <Link href={RESPONDER_PATH}>{c.lockedAction} <ArrowRight aria-hidden="true" /></Link>
      </Button>
    </section>
  );
}

function CourseBody({
  course,
  responderName,
  activeId,
  onSelect,
  onPassed,
}: {
  course: Course;
  responderName: string;
  activeId: string | null;
  onSelect: (id: string) => void;
  onPassed: () => void;
}) {
  const c = courseCopy;
  const lessons = course.lessons;
  const active = lessons.find((lesson) => lesson.id === activeId) ?? lessons.find((lesson) => lesson.id === course.nextLessonId) ?? lessons[0];
  const index = lessons.findIndex((lesson) => lesson.id === active?.id);
  const next = lessons[index + 1];

  return (
    <>
      <section className="mt-7 rounded-2xl border border-line bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black text-ink">{course.title}</h2>
            <p className="mt-1 max-w-150 text-[15px] leading-[1.6] text-muted-foreground">{course.summary}</p>
            {responderName && <p className="mt-2 text-sm font-semibold text-ink">{c.enrolledAs(responderName)}</p>}
          </div>
          <p className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-brand">
            <ShieldCheck aria-hidden="true" className="size-3.5" /> {course.audience}
          </p>
        </div>

        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-[#f1f1f1]" role="progressbar" aria-valuenow={course.progressPercent} aria-valuemin={0} aria-valuemax={100} aria-label={c.progress(course.completedLessons, course.lessonCount)}>
            <span className="block h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${course.progressPercent}%` }} />
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-semibold text-ink">{c.progress(course.completedLessons, course.lessonCount)}</span>
            {course.completed && <span className="inline-flex items-center gap-1 font-bold text-[#1e7d3a]"><CheckCircle2 aria-hidden="true" className="size-4" /> {c.completed}</span>}
          </div>
        </div>
      </section>

      <section className="mt-6" aria-labelledby="course-lessons">
        <h2 id="course-lessons" className="text-lg font-bold text-ink">{c.lessons}</h2>
        <ol className="mt-3 grid gap-2">
          {lessons.map((lesson, position) => (
            <li key={lesson.id}>
              <button
                type="button"
                onClick={() => onSelect(lesson.id)}
                aria-current={lesson.id === active?.id ? "step" : undefined}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition",
                  lesson.id === active?.id ? "border-brand bg-brand-soft" : "border-line bg-white hover:border-brand",
                )}
              >
                <span className={cn("grid size-8 shrink-0 place-items-center rounded-full text-sm font-black", lesson.completed ? "bg-[#1e7d3a] text-white" : "bg-[#f1f1f1] text-ink")}>
                  {lesson.completed ? <CheckCircle2 aria-hidden="true" className="size-4.5" /> : position + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold text-ink">{lesson.title}</span>
                  <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock3 aria-hidden="true" className="size-3.5" /> {c.minutes(lesson.minutes)}
                    {lesson.completed && <span className="ml-1 font-semibold text-[#1e7d3a]">· {c.done}</span>}
                  </span>
                </span>
                <ArrowRight aria-hidden="true" className={cn("size-4 shrink-0", lesson.id === active?.id ? "text-brand" : "text-muted-foreground")} />
              </button>
            </li>
          ))}
        </ol>
      </section>

      {active && (
        <section className="mt-6 rounded-2xl border border-line bg-white p-5" aria-labelledby="active-lesson">
          <p className="text-xs font-bold tracking-[.12em] text-brand uppercase">{c.lesson(index + 1)}</p>
          <h2 id="active-lesson" className="mt-1 text-2xl font-black text-ink">{active.title}</h2>
          <p className="mt-1.5 text-[15px] leading-[1.6] text-muted-foreground">{active.summary}</p>

          <div className="mt-5 grid gap-5">
            {active.sections.map((section) => (
              <div key={section.heading}>
                <h3 className="text-[17px] font-bold text-ink">{section.heading}</h3>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph} className="mt-1.5 text-[15px] leading-[1.7] text-ink">{paragraph}</p>
                ))}
                {section.bullets.length > 0 && (
                  <ul className="mt-2 grid list-disc gap-1.5 pl-5 text-[15px] leading-[1.65] text-ink">
                    {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                  </ul>
                )}
              </div>
            ))}
          </div>

          <p className="mt-5 border-t border-line pt-3 text-xs leading-[1.6] text-muted-foreground">{course.disclaimer}</p>
        </section>
      )}

      {active && (
        <QuizPanel
          key={active.id}
          courseId={course.id}
          lesson={active}
          onPassed={onPassed}
          nextLesson={next}
          onNext={next ? () => onSelect(next.id) : undefined}
        />
      )}
    </>
  );
}

function QuizPanel({
  courseId,
  lesson,
  onPassed,
  nextLesson,
  onNext,
}: {
  courseId: string;
  lesson: CourseLesson;
  onPassed: () => void;
  nextLesson: CourseLesson | undefined;
  onNext?: () => void;
}) {
  const c = courseCopy;
  const authFetch = useAuthFetch();
  const [answers, setAnswers] = useState<(number | null)[]>(() => lesson.quiz.map(() => null));
  const [result, setResult] = useState<QuizResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (answers.some((answer) => answer === null)) {
      setError(c.answerRequired);
      return;
    }
    setBusy(true);
    setError("");
    const response = await authFetch(`/api/courses/${courseId}/lessons/${lesson.id}/quiz`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    });
    setBusy(false);
    if (!response.ok) {
      setError(response.status === 400 ? c.answerRequired : c.loadFailed);
      return;
    }
    const graded = (await response.json()) as QuizResult;
    setResult(graded);
    if (graded.passed) onPassed();
  };

  const retry = () => {
    setAnswers(lesson.quiz.map(() => null));
    setResult(null);
    setError("");
  };

  return (
    <section className="mt-6 rounded-2xl border border-line bg-white p-5" aria-labelledby="course-quiz">
      <h2 id="course-quiz" className="flex items-center gap-2 text-lg font-bold text-ink">
        <BookOpenCheck aria-hidden="true" className="size-5 text-brand" /> {c.quizTitle}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{c.quizHint}</p>

      <form onSubmit={submit} className="mt-4 grid gap-5" noValidate>
        {lesson.quiz.map((question, questionIndex) => {
          const graded = result?.results[questionIndex];
          const selected = answers[questionIndex];
          return (
            <fieldset key={question.id}>
              <legend className="text-[15px] font-bold leading-[1.5] text-ink">
                {questionIndex + 1}. {question.question}
              </legend>
              <div className="mt-2 grid gap-2">
                {question.options.map((option, optionIndex) => {
                  const correct = graded !== undefined && optionIndex === graded.correctIndex;
                  const wrong = graded !== undefined && selected === optionIndex && !correct;
                  return (
                    <label
                      key={option}
                      className={cn(
                        "flex cursor-pointer items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-[15px] leading-[1.5] text-ink transition",
                        selected === optionIndex ? "border-brand bg-brand-soft" : "border-line hover:border-brand",
                        correct && "border-[#1e7d3a] bg-[#eef8f1]",
                        wrong && "border-brand bg-[#fdecea]",
                        result && "cursor-default",
                      )}
                    >
                      <input
                        type="radio"
                        name={`${lesson.id}-${question.id}`}
                        value={optionIndex}
                        checked={selected === optionIndex}
                        disabled={result !== null}
                        onChange={() => setAnswers((current) => current.map((value, i) => (i === questionIndex ? optionIndex : value)))}
                        className="mt-0.5 accent-brand"
                      />
                      <span className="flex-1">{option}</span>
                      {correct && <CheckCircle2 aria-label={c.correctAnswer} className="mt-0.5 size-4.5 shrink-0 text-[#1e7d3a]" />}
                    </label>
                  );
                })}
              </div>
              {graded && (
                <p className={cn("mt-2 rounded-lg px-3 py-2 text-sm leading-[1.55]", graded.correct ? "bg-[#eef8f1] text-[#145c2a]" : "bg-[#fdf0ed] text-[#8a2412]")}>
                  {graded.explanation}
                </p>
              )}
            </fieldset>
          );
        })}

        {error && <p className="text-sm font-semibold text-brand" role="alert">{error}</p>}

        {result && (
          <p className={cn("rounded-xl px-4 py-3 text-[15px] font-semibold leading-[1.5]", result.passed ? "bg-[#eef8f1] text-[#145c2a]" : "bg-[#fdf0ed] text-[#8a2412]")} role="status">
            {result.passed ? c.passed : c.failed(result.correctCount, result.total)}
          </p>
        )}

        <div className="flex flex-wrap gap-2.5">
          {!result && (
            <Button type="submit" disabled={busy} className="h-11 rounded-full font-bold">
              {busy ? c.submitting : c.submit}
            </Button>
          )}
          {result?.passed && nextLesson && (
            <Button type="button" onClick={onNext} className="h-11 rounded-full font-bold">
              {c.next}: {nextLesson.title} <ArrowRight aria-hidden="true" />
            </Button>
          )}
          {result?.passed && !nextLesson && (
            <p className="inline-flex items-center gap-1.5 text-[15px] font-bold text-[#1e7d3a]">
              <CheckCircle2 aria-hidden="true" className="size-5" /> {c.lessonDone}
            </p>
          )}
          {result && !result.passed && (
            <Button type="button" variant="outline" onClick={retry} className="h-11 rounded-full font-semibold">
              <RotateCcw aria-hidden="true" /> {c.retry}
            </Button>
          )}
        </div>
      </form>
    </section>
  );
}
