"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  ArrowRight,
  Award,
  BookOpenCheck,
  CheckCircle2,
  ExternalLink,
  Lightbulb,
  LockKeyhole,
  PlayCircle,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import Navbar from "@/components/site/landing/Navbar";
import { Page } from "@/components/site/primitives";
import { Button } from "@/components/ui/button";
import { appNav, courseCopy, formatCourseDate } from "@/content/app";
import { useAuthFetch, useSession } from "@/hooks/use-auth";
import { ACCOUNT_PATH, loginUrl } from "@/lib/auth/paths";
import type { Course, CourseLesson, CourseOverview, CourseVideo, QuizResult } from "@/lib/courses/types";
import { cn } from "@/lib/utils";

type Profile = { enrolled: boolean; selfEnrollEnabled: boolean; displayName?: string };

const LOGIN_NEXT = loginUrl("/app/khoa-hoc");
const RESPONDER_PATH = "/app/san-sang-ho-tro";

const watchKey = (courseId: string, lessonId: string) => `${courseId}:${lessonId}`;

// Khóa học sơ cứu: chỉ tài khoản đã đăng ký làm người hỗ trợ mới thấy nội dung. Người chưa đăng ký thấy thẻ khóa
// kèm lối sang trang "Sẵn sàng hỗ trợ"; máy chủ cũng trả 403 nên nội dung không lộ khi gọi thẳng API.
// Mỗi bài: xem video (YouTube, Bệnh viện Hoàn Mỹ Đà Nẵng) trước, rồi mới mở câu hỏi kiểm tra.
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
  const courses = overview.data?.courses ?? [];
  const [courseId, setCourseId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  // Bài đã bấm "đã xem xong video" trong phiên này (bài đã hoàn thành thì không cần)
  const [watched, setWatched] = useState<ReadonlySet<string>>(() => new Set());
  // Chưa chọn: khóa đầu tiên chưa xong, nếu đã xong hết thì khóa đầu tiên
  const course = courses.find((item) => item.id === courseId) ?? courses.find((item) => !item.completed) ?? courses[0];

  const selectCourse = (id: string) => {
    setCourseId(id);
    setActiveId(null);
  };

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

        {course && courses.length > 1 && <CoursePicker courses={courses} selectedId={course.id} onSelect={selectCourse} />}

        {course && (
          <CourseBody
            key={course.id}
            course={course}
            responderName={overview.data?.responderName ?? ""}
            activeId={activeId}
            onSelect={setActiveId}
            watched={watched}
            onWatched={(lessonId) => setWatched((current) => new Set(current).add(watchKey(course.id, lessonId)))}
            onPassed={(lessonId) => {
              // Giữ nguyên khóa và bài đang học khi dữ liệu được tải lại (nextLessonId sẽ đổi sau khi qua bài)
              setCourseId(course.id);
              setActiveId(lessonId);
              void overview.mutate();
            }}
          />
        )}
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

function CoursePicker({ courses, selectedId, onSelect }: { courses: Course[]; selectedId: string; onSelect: (id: string) => void }) {
  const c = courseCopy;
  return (
    <section className="mt-7" aria-labelledby="course-picker">
      <h2 id="course-picker" className="text-lg font-bold text-ink">{c.pickCourse}</h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {courses.map((item) => {
          const selected = item.id === selectedId;
          return (
            <li key={item.id} className="flex">
              <button
                type="button"
                onClick={() => onSelect(item.id)}
                aria-pressed={selected}
                className={cn(
                  "flex w-full cursor-pointer flex-col rounded-2xl border bg-white p-4 text-left transition",
                  selected ? "border-brand bg-brand-soft ring-1 ring-brand" : "border-line hover:border-brand",
                )}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="text-[16px] leading-[1.35] font-black text-ink">{item.title}</span>
                  {item.completed && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#eef8f1] px-2 py-0.5 text-xs font-bold text-[#1e7d3a]">
                      <CheckCircle2 aria-hidden="true" className="size-3.5" /> {c.courseDone}
                    </span>
                  )}
                </span>
                <span className="mt-1 line-clamp-3 text-sm leading-[1.55] text-muted-foreground">{item.summary}</span>
                <span className="mt-auto pt-3">
                  <span className="block h-1.5 overflow-hidden rounded-full bg-[#f1f1f1]" aria-hidden="true">
                    <span
                      className={cn("block h-full rounded-full", item.completed ? "bg-[#1e7d3a]" : "bg-brand")}
                      style={{ width: `${item.progressPercent}%` }}
                    />
                  </span>
                  <span className="mt-1.5 block text-xs font-semibold text-ink">{c.lessonCount(item.completedLessons, item.lessonCount)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function CourseBody({
  course,
  responderName,
  activeId,
  onSelect,
  watched,
  onWatched,
  onPassed,
}: {
  course: Course;
  responderName: string;
  activeId: string | null;
  onSelect: (id: string) => void;
  watched: ReadonlySet<string>;
  onWatched: (lessonId: string) => void;
  onPassed: (lessonId: string) => void;
}) {
  const c = courseCopy;
  const lessons = course.lessons;
  const active = lessons.find((lesson) => lesson.id === activeId) ?? lessons.find((lesson) => lesson.id === course.nextLessonId) ?? lessons[0];
  const index = lessons.findIndex((lesson) => lesson.id === active?.id);
  const next = lessons[index + 1];
  const quizOpen = active !== undefined && (active.completed || watched.has(watchKey(course.id, active.id)));
  const completedOn = formatCourseDate(course.completedAt);

  return (
    <>
      <section className="mt-6 rounded-2xl border border-line bg-white p-5">
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

        {course.completed && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#cdebd6] bg-[#f1fbf4] px-4 py-3" role="status">
            <p className="flex items-start gap-2 text-[15px] leading-[1.5] text-[#145c2a]">
              <Award aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-[#1e7d3a]" />
              <span>
                <strong className="font-bold">{c.recorded(course.badge)}</strong>
                {completedOn && <span className="block text-sm">{c.completedOn(completedOn)}</span>}
              </span>
            </p>
            <Link href={ACCOUNT_PATH} className="inline-flex items-center gap-1 text-sm font-bold text-[#1e7d3a] hover:underline">
              {c.viewProfile} <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
        )}
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
                    <PlayCircle aria-hidden="true" className="size-3.5" /> {c.minutes(lesson.minutes)}
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

          <VideoPlayer key={`${course.id}:${active.id}`} video={active.video} />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <p className="min-w-0 flex-1 text-xs leading-[1.55] text-muted-foreground">
              {c.videoCredit(active.video.title, course.source.name)}
            </p>
            <Button asChild variant="outline" className="h-9 shrink-0 rounded-full font-semibold">
              <a href={active.video.url} target="_blank" rel="noopener noreferrer">
                <PlayCircle aria-hidden="true" /> {c.watchOnYouTube} <ExternalLink aria-hidden="true" />
                <span className="sr-only">{c.newTab}</span>
              </a>
            </Button>
          </div>
          <p className="mt-1.5 text-xs leading-[1.55] text-muted-foreground">{c.videoBlockedHint}</p>

          {active.sections.length > 0 && (
            <div className="mt-5 rounded-xl bg-[#fafafa] p-4">
              <h3 className="flex items-center gap-1.5 text-[17px] font-bold text-ink">
                <Lightbulb aria-hidden="true" className="size-4.5 text-brand" /> {c.keyPoints}
              </h3>
              <div className="mt-2 grid gap-3.5">
                {active.sections.map((section) => (
                  <div key={section.heading}>
                    {section.heading && <h4 className="text-[15px] font-bold text-ink">{section.heading}</h4>}
                    {section.paragraphs.map((paragraph) => (
                      <p key={paragraph} className="mt-1 text-[15px] leading-[1.65] text-ink">{paragraph}</p>
                    ))}
                    {section.bullets.length > 0 && (
                      <ul className="mt-1.5 grid list-disc gap-1 pl-5 text-[15px] leading-[1.6] text-ink">
                        {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {active && quizOpen && (
        <QuizPanel
          key={watchKey(course.id, active.id)}
          courseId={course.id}
          lesson={active}
          onPassed={() => onPassed(active.id)}
          nextLesson={next}
          onNext={next ? () => onSelect(next.id) : undefined}
          recordedBadge={course.completed ? course.badge : undefined}
        />
      )}

      {active && !quizOpen && (
        <section className="mt-6 rounded-2xl border border-dashed border-line bg-white p-5" aria-labelledby="course-quiz-locked">
          <h2 id="course-quiz-locked" className="flex items-center gap-2 text-lg font-bold text-ink">
            <LockKeyhole aria-hidden="true" className="size-5 text-muted-foreground" /> {c.quizTitle}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{c.quizLocked}</p>
          <Button type="button" onClick={() => onWatched(active.id)} className="mt-4 h-auto min-h-11 rounded-full py-2 font-bold whitespace-normal">
            <CheckCircle2 aria-hidden="true" /> {c.watchedButton}
          </Button>
        </section>
      )}

      <footer className="mt-6 border-t border-line pt-4 text-xs leading-[1.65] text-muted-foreground">
        <p>
          <span className="font-semibold text-ink">{c.sourceTitle}:</span>{" "}
          <a href={course.source.channelUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand hover:underline">
            {course.source.name}<span className="sr-only"> {c.newTab}</span>
          </a>
          {" · "}
          {c.sourcePlaylist}:{" "}
          <a href={course.source.playlistUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand hover:underline">
            {course.source.playlistTitle}<span className="sr-only"> {c.newTab}</span>
          </a>
        </p>
        {course.source.note && <p className="mt-1">{course.source.note}</p>}
        <p className="mt-2">{course.disclaimer}</p>
      </footer>
    </>
  );
}

// Thumbnail with a play button; the YouTube iframe only loads once the learner presses play. The frame is never an
// empty black box: if a browser or extension blocks the iframe, the thumbnail and the "Xem trên YouTube" button remain.
function VideoPlayer({ video }: { video: CourseVideo }) {
  const c = courseCopy;
  const [playing, setPlaying] = useState(false);
  const separator = video.embedUrl.includes("?") ? "&" : "?";

  return (
    <div className="relative mt-4 aspect-video w-full overflow-hidden rounded-xl bg-[#111]">
      {playing ? (
        <iframe
          src={`${video.embedUrl}${separator}autoplay=1`}
          title={video.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 size-full border-0"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label={c.playVideo(video.title)}
          className="group absolute inset-0 size-full cursor-pointer"
        >
          <img
            src={`https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg`}
            alt=""
            className="absolute inset-0 size-full object-cover transition duration-300 group-hover:scale-[1.02]"
          />
          <span className="absolute inset-0 bg-black/25 transition group-hover:bg-black/15" aria-hidden="true" />
          <span
            className="absolute top-1/2 left-1/2 grid h-14 w-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-2xl bg-[#ff0000] shadow-lg transition group-hover:scale-105"
            aria-hidden="true"
          >
            <span className="ml-1 size-0 border-y-[11px] border-l-[18px] border-y-transparent border-l-white" />
          </span>
        </button>
      )}
    </div>
  );
}

function QuizPanel({
  courseId,
  lesson,
  onPassed,
  nextLesson,
  onNext,
  recordedBadge,
}: {
  courseId: string;
  lesson: CourseLesson;
  onPassed: () => void;
  nextLesson: CourseLesson | undefined;
  onNext?: () => void;
  recordedBadge?: string;
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

  // The grading response already carries the updated course, so the "recorded" note shows before the refetch lands
  const badge = result?.course?.completed ? result.course.badge : recordedBadge;

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

        <div className="flex flex-wrap items-center gap-2.5">
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
              <CheckCircle2 aria-hidden="true" className="size-5" /> {badge ? c.recorded(badge) : c.lessonDone}
            </p>
          )}
          {result?.passed && !nextLesson && badge && (
            <Link href={ACCOUNT_PATH} className="inline-flex items-center gap-1 text-sm font-bold text-[#1e7d3a] hover:underline">
              {c.viewProfile} <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
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
