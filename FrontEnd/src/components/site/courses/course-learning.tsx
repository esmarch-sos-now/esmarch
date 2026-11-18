"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { ArrowLeft, ArrowRight, Award, BookOpenCheck, CheckCircle2, ExternalLink, Lightbulb, LockKeyhole, PartyPopper, PlayCircle, RotateCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { courseCopy } from "@/content/app";
import { useAuthFetch, useSession } from "@/hooks/use-auth";
import { useSupporterProfile } from "@/hooks/use-supporter";
import { ACCOUNT_PATH, COURSES_PATH, QUIZ_PATH } from "@/lib/auth/paths";
import type { Course, CourseLesson, CourseOverview, LessonQuiz, QuizResult } from "@/lib/courses/types";
import { formatClock, loadYouTubeApi, PlayerState, type YouTubePlayer } from "@/lib/courses/youtube";
import { cn } from "@/lib/utils";

/** The course page, opened on one lesson (the one the learner came back from); `rewatch` says the video was reset. */
export const lessonHref = (courseId: string, lessonId: string, rewatch = false) =>
  `${COURSES_PATH}?khoa=${encodeURIComponent(courseId)}&bai=${encodeURIComponent(lessonId)}${rewatch ? "&xem-lai=1" : ""}`;
export const quizHref = (courseId: string, lessonId: string) =>
  `${QUIZ_PATH}?khoa=${encodeURIComponent(courseId)}&bai=${encodeURIComponent(lessonId)}`;
export const courseHref = (courseId: string) => `${COURSES_PATH}?khoa=${encodeURIComponent(courseId)}`;

/** A course just finished by a passed quiz, and how many are left: what the congratulations says. */
export type Finished = { course: Course; remaining: number };

/** The signed-in user's courses (shared by the course page and the quiz page through the SWR cache). */
export function useCourses() {
  const { user } = useSession();
  const authFetch = useAuthFetch();
  const supporter = useSupporterProfile();
  const overview = useSWR<CourseOverview>(
    user ? `courses:${user.id}` : null,
    async () => {
      const response = await authFetch("/api/courses");
      if (!response.ok) throw new Error(String(response.status));
      return (await response.json()) as CourseOverview;
    },
    // Progress only changes through these pages (watch reports and graded quizzes return it), so no refetch on focus.
    { revalidateOnFocus: false },
  );
  const courses = overview.data?.courses ?? [];

  // A graded quiz returns the updated course: put it in the cache instead of refetching the whole overview. Only a
  // finished course also changes `completedCourses`, so that case revalidates. Returns the course when this finished it.
  const applyCourse = (updated: Course): Finished | null => {
    const before = courses.find((item) => item.id === updated.id);
    const finished =
      updated.completed && before && !before.completed
        ? { course: updated, remaining: courses.filter((item) => item.id !== updated.id && !item.completed).length }
        : null;
    void overview.mutate(
      (current) => current && { ...current, courses: current.courses.map((item) => (item.id === updated.id ? updated : item)) },
      { revalidate: updated.completed },
    );
    // A passed lesson moves the sign-up steps (progress, then learning -> ready)
    void supporter.mutate();
    return finished;
  };

  // A watch report returns the lesson (how far the video got, whether the quiz is open): patch it into the cache.
  const applyLesson = (courseId: string, lesson: CourseLesson) => {
    void overview.mutate(
      (current) =>
        current && {
          ...current,
          courses: current.courses.map((item) =>
            item.id === courseId ? { ...item, lessons: item.lessons.map((l) => (l.id === lesson.id ? lesson : l)) } : item,
          ),
        },
      { revalidate: false },
    );
  };

  return { overview, courses, applyCourse, applyLesson };
}

// The first-aid courses, on their own page (/app/khoa-hoc, opened from the supporter page by "Bắt đầu học" / "Học tiếp"
// / "Xem lại khóa học"). Each lesson: watch the video (YouTube, Bệnh viện Hoàn Mỹ Đà Nẵng) on the page; the player
// reports how far it got, and the server opens the quiz once 90% of it has played (see BackEnd courses/service.py). The
// key points come with it, and so does "Làm bài kiểm tra", which leads to the quiz page (/app/khoa-hoc/kiem-tra).
// `?khoa=&bai=` opens a given course and lesson (the way back from the quiz); `xem-lai=1` says the video was reset.
export default function CourseLearning() {
  const c = courseCopy;
  const params = useSearchParams();
  const { overview, courses, applyLesson } = useCourses();
  const [courseId, setCourseId] = useState<string | null>(() => params.get("khoa"));
  const [activeId, setActiveId] = useState<string | null>(() => params.get("bai"));
  const rewatchFor = params.get("xem-lai") === "1" ? params.get("bai") : null;
  // Nothing selected: the first unfinished course, or the first course when all are done
  const course = courses.find((item) => item.id === courseId) ?? courses.find((item) => !item.completed) ?? courses[0];

  const selectCourse = (id: string) => {
    setCourseId(id);
    setActiveId(null);
  };

  return (
    <div className="mt-2">
      {overview.isLoading && <p className="mt-6 text-sm text-muted-foreground">{c.loading}</p>}

      {overview.error && (
        <section className="mt-6">
          <p className="text-[15px] text-ink">{c.loadFailed}</p>
          <Button variant="outline" onClick={() => void overview.mutate()} className="mt-4 rounded-full">{c.retryLoad}</Button>
        </section>
      )}

      {overview.data && courses.length === 0 && <p className="mt-6 text-sm text-muted-foreground">{c.noCourses}</p>}

      {course && courses.length > 1 && <CoursePicker courses={courses} selectedId={course.id} onSelect={selectCourse} />}

      {course && (
        <CourseBody
          key={course.id}
          course={course}
          activeId={course.lessons.some((lesson) => lesson.id === activeId) ? activeId : null}
          onSelect={setActiveId}
          onLessonUpdated={(lesson) => applyLesson(course.id, lesson)}
          rewatchFor={rewatchFor}
        />
      )}
    </div>
  );
}

// "Chúc mừng" once a course is finished: back to the supporter page (the main way out once every course is done), or
// on to the next course.
export function Celebration({
  course,
  allDone,
  remaining,
  backHref,
  backLabel,
  onNextCourse,
  onClose,
}: {
  course: Course;
  allDone: boolean;
  remaining: number;
  backHref: string;
  backLabel: string;
  onNextCourse: () => void;
  onClose: () => void;
}) {
  const c = courseCopy.congrats;
  const primaryRef = useRef<HTMLAnchorElement & HTMLButtonElement>(null);
  useEffect(() => {
    primaryRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="course-congrats"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-110 rounded-3xl bg-white p-6 text-center shadow-xl"
      >
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-[#eef8f1] text-[#1e7d3a]" aria-hidden="true">
          <PartyPopper className="size-8" />
        </span>
        <h2 id="course-congrats" className="mt-4 text-2xl leading-[1.25] font-black text-ink">
          {allDone ? c.allTitle : c.courseTitle}
        </h2>
        <p className="mt-2 text-[15px] leading-[1.6] text-muted-foreground">
          {allDone ? c.allBody : c.courseBody(course.title, remaining)}
        </p>
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#eef8f1] px-3 py-1 text-xs font-bold text-[#1e7d3a]">
          <Award aria-hidden="true" className="size-3.5" /> {course.badge}
        </p>
        <div className="mt-6 grid gap-2.5">
          {allDone ? (
            <Button ref={primaryRef} asChild className="h-11 rounded-full font-bold">
              <Link href={backHref}>
                <ArrowLeft aria-hidden="true" /> {backLabel}
              </Link>
            </Button>
          ) : (
            <>
              <Button ref={primaryRef} type="button" onClick={onNextCourse} className="h-11 rounded-full font-bold">
                {c.nextCourse} <ArrowRight aria-hidden="true" />
              </Button>
              <Button asChild variant="outline" className="h-11 rounded-full font-semibold">
                <Link href={backHref}>
                  <ArrowLeft aria-hidden="true" /> {backLabel}
                </Link>
              </Button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function CoursePicker({ courses, selectedId, onSelect }: { courses: Course[]; selectedId: string; onSelect: (id: string) => void }) {
  const c = courseCopy;
  return (
    <section className="mt-7" aria-labelledby="course-picker">
      <h2 id="course-picker" className="text-lg font-bold text-ink">{c.pickCourse}</h2>
      {/* One row per course: title and status, then its progress; the selected one is marked in the brand colour */}
      <ul className="mt-2 grid divide-y divide-line">
        {courses.map((item) => {
          const selected = item.id === selectedId;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onSelect(item.id)}
                aria-pressed={selected}
                className={cn(
                  "group grid w-full cursor-pointer gap-2 border-l-[3px] py-3 pr-1 pl-3 text-left transition",
                  selected ? "border-brand" : "border-transparent",
                )}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className={cn("text-[16px] leading-[1.35] font-black", selected ? "text-brand" : "text-ink group-hover:text-brand")}>
                    {item.title}
                  </span>
                  {item.completed && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#eef8f1] px-2 py-0.5 text-xs font-bold text-[#1e7d3a]">
                      <CheckCircle2 aria-hidden="true" className="size-3.5" /> {c.courseDone}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-3">
                  <span className="block h-1.5 flex-1 overflow-hidden rounded-full bg-[#f1f1f1]" aria-hidden="true">
                    <span
                      className={cn("block h-full rounded-full", item.completed ? "bg-[#1e7d3a]" : "bg-brand")}
                      style={{ width: `${item.progressPercent}%` }}
                    />
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-ink">{c.lessonCount(item.completedLessons, item.lessonCount)}</span>
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
  activeId,
  onSelect,
  onLessonUpdated,
  rewatchFor,
}: {
  course: Course;
  activeId: string | null;
  onSelect: (id: string) => void;
  onLessonUpdated: (lesson: CourseLesson) => void;
  /** The lesson whose video was reset by failed quizzes (back from the quiz page) */
  rewatchFor: string | null;
}) {
  const c = courseCopy;
  const lessons = course.lessons;
  const active = lessons.find((lesson) => lesson.id === activeId) ?? lessons.find((lesson) => lesson.id === course.nextLessonId) ?? lessons[0];
  const index = lessons.findIndex((lesson) => lesson.id === active?.id);
  // Set by the server: the video was watched, or the lesson was already passed
  const quizOpen = active !== undefined && active.watched;
  const videoRef = useRef<HTMLDivElement>(null);

  // Back from the quiz page on a given lesson: bring its video into view
  const comingBack = useRef(activeId !== null);
  useEffect(() => {
    if (!comingBack.current) return;
    comingBack.current = false;
    videoRef.current?.scrollIntoView({ block: "center" });
  }, []);

  return (
    <>
      <section className="mt-8" aria-labelledby="course-lessons">
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
        <section className="mt-8 border-t border-line pt-6" aria-labelledby="active-lesson">
          <p className="text-xs font-bold tracking-[.12em] text-brand uppercase">{c.lesson(index + 1)}</p>
          <h2 id="active-lesson" className="mt-1 text-2xl font-black text-ink">{active.title}</h2>
          <p className="mt-1.5 text-[15px] leading-[1.6] text-muted-foreground">{active.summary}</p>

          <div ref={videoRef}>
            <VideoPlayer key={`${course.id}:${active.id}`} courseId={course.id} lesson={active} onLesson={onLessonUpdated} />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <p className="min-w-0 flex-1 text-xs leading-[1.55] text-muted-foreground">
              {c.videoCredit(active.video.title, course.source.name)}
            </p>
            {/* Watching on YouTube cannot be tracked: the link is only there to review a passed lesson */}
            {active.completed && (
              <Button asChild variant="outline" className="h-9 shrink-0 rounded-full font-semibold">
                <a href={active.video.url} target="_blank" rel="noopener noreferrer">
                  <PlayCircle aria-hidden="true" /> {c.watchOnYouTube} <ExternalLink aria-hidden="true" />
                  <span className="sr-only">{c.newTab}</span>
                </a>
              </Button>
            )}
          </div>
          {!active.completed && <p className="mt-1.5 text-xs leading-[1.55] text-muted-foreground">{c.videoBlockedHint}</p>}

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
        <section className="mt-8 border-t border-line pt-6" aria-labelledby="course-quiz-entry">
          <h2 id="course-quiz-entry" className="flex items-center gap-2 text-lg font-bold text-ink">
            <BookOpenCheck aria-hidden="true" className="size-5 text-brand" /> {c.quizTitle}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{active.completed ? c.quizReview : c.quizReady}</p>
          <Button asChild variant={active.completed ? "outline" : "default"} className="mt-4 h-11 rounded-full px-5 font-bold">
            <Link href={quizHref(course.id, active.id)}>
              {active.completed ? c.retakeQuiz : c.takeQuiz} <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </section>
      )}

      {active && !quizOpen && (
        <section className="mt-8 border-t border-line pt-6" aria-labelledby="course-quiz-locked">
          <h2 id="course-quiz-locked" className="flex items-center gap-2 text-lg font-bold text-ink">
            <LockKeyhole aria-hidden="true" className="size-5 text-muted-foreground" /> {c.quizTitle}
          </h2>
          {rewatchFor === active.id && (
            <p className="mt-2 rounded-lg bg-[#fdf0ed] px-3 py-2 text-sm font-semibold text-[#8a2412]" role="status">{c.mustRewatch}</p>
          )}
          <p className="mt-1 text-sm text-muted-foreground">{c.quizLocked}</p>
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

const TICK_MS = 500; // how often the player position is checked
const REPORT_MS = 5000; // how often progress is reported while playing (the server credits at most ~15 s per report)
const SEEK_TOLERANCE_SECONDS = 1.5;
const RESYNC_SECONDS = 10; // the server's point lags further behind than this: go back to it

// Thumbnail with a play button; the YouTube player (IFrame API) only loads once the learner presses play. Until the
// quiz is open, the player keeps track of the furthest point reached by playing, sends it to the server, does not let
// the learner skip ahead of it (going back is fine), keeps the speed at 1x and pauses when the tab is hidden. Once the
// quiz is open (`lesson.watched`), the video is free to seek.
function VideoPlayer({ courseId, lesson, onLesson }: { courseId: string; lesson: CourseLesson; onLesson: (lesson: CourseLesson) => void }) {
  const c = courseCopy;
  const video = lesson.video;
  const authFetch = useAuthFetch();
  const watchUrl = `/api/courses/${courseId}/lessons/${lesson.id}/watch`;
  const [playing, setPlaying] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [seekBlocked, setSeekBlocked] = useState(false);
  const [furthest, setFurthest] = useState(lesson.watchedSeconds);
  const hostRef = useRef<HTMLDivElement>(null);
  // Read inside the player's callbacks without recreating the player
  const trackedRef = useRef(!lesson.watched);
  const onLessonRef = useRef(onLesson);
  // Furthest point reached by playing; outlives the player, so a new player resumes from it
  const markRef = useRef(lesson.watched ? 0 : lesson.watchedSeconds);
  useEffect(() => {
    trackedRef.current = !lesson.watched;
    onLessonRef.current = onLesson;
    // The server is the source of truth: after too many failed quizzes it resets the video to 0
    if (!lesson.watched && markRef.current > lesson.watchedSeconds + RESYNC_SECONDS) markRef.current = lesson.watchedSeconds;
  });
  // Same for the bar shown (adjusted during render, as React recommends over an effect)
  const [shownWatched, setShownWatched] = useState(lesson.watched);
  if (shownWatched !== lesson.watched) {
    setShownWatched(lesson.watched);
    if (!lesson.watched) setFurthest(lesson.watchedSeconds);
  }

  useEffect(() => {
    if (!seekBlocked) return;
    const timer = window.setTimeout(() => setSeekBlocked(false), 4000);
    return () => window.clearTimeout(timer);
  }, [seekBlocked]);

  useEffect(() => {
    const host = hostRef.current;
    if (!playing || !host) return;
    let cancelled = false;
    let player: YouTubePlayer | null = null;
    let ready = false;
    let inFlight = false;
    const start = markRef.current >= video.seconds - 3 ? 0 : Math.floor(markRef.current);
    let lastTick = performance.now();
    const timers: number[] = [];

    const report = async () => {
      if (!trackedRef.current || inFlight) return;
      inFlight = true;
      try {
        const response = await authFetch(watchUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ seconds: Math.round(markRef.current * 10) / 10 }),
        });
        if (response.ok && !cancelled) {
          const updated = (await response.json()) as CourseLesson;
          // The server only credits real playing time; if it is well behind, continue from its point
          if (!updated.watched && updated.watchedSeconds + RESYNC_SECONDS < markRef.current) {
            markRef.current = updated.watchedSeconds;
            setFurthest(markRef.current);
          }
          onLessonRef.current(updated);
        }
      } catch {
        // Offline for a moment: the next report carries the same point
      } finally {
        inFlight = false;
      }
    };

    const tick = () => {
      if (!player || !ready) return;
      const now = performance.now();
      const elapsed = (now - lastTick) / 1000;
      lastTick = now;
      const time = player.getCurrentTime();
      const isPlaying = player.getPlayerState() === PlayerState.PLAYING;
      const mark = markRef.current;
      if (trackedRef.current && time > mark + (isPlaying ? elapsed : 0) + SEEK_TOLERANCE_SECONDS) {
        player.seekTo(mark, true);
        setSeekBlocked(true);
        return;
      }
      if (time > mark) {
        markRef.current = Math.min(time, video.seconds);
        setFurthest(markRef.current);
      }
    };

    const onVisibility = () => {
      if (document.hidden && trackedRef.current && ready) player?.pauseVideo();
    };
    document.addEventListener("visibilitychange", onVisibility);

    loadYouTubeApi()
      .then((api) => {
        if (cancelled) return;
        const target = document.createElement("div"); // replaced by the iframe; React does not own it
        host.replaceChildren(target);
        player = new api.Player(target, {
          videoId: video.youtubeId,
          host: "https://www.youtube-nocookie.com",
          width: "100%",
          height: "100%",
          playerVars: { autoplay: 1, rel: 0, playsinline: 1, start, origin: window.location.origin },
          events: {
            onReady: () => {
              ready = true;
              lastTick = performance.now();
            },
            onStateChange: ({ data }) => {
              if (data === PlayerState.PLAYING) lastTick = performance.now();
              if (data === PlayerState.PLAYING || data === PlayerState.PAUSED || data === PlayerState.ENDED) void report();
            },
            onPlaybackRateChange: ({ target: changed, data }) => {
              if (trackedRef.current && data > 1) changed.setPlaybackRate(1);
            },
            onError: () => setBlocked(true),
          },
        });
        timers.push(window.setInterval(tick, TICK_MS));
        timers.push(
          window.setInterval(() => {
            if (ready && player?.getPlayerState() === PlayerState.PLAYING) void report();
          }, REPORT_MS),
        );
      })
      .catch(() => {
        if (!cancelled) setBlocked(true);
      });

    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearInterval(timer));
      document.removeEventListener("visibilitychange", onVisibility);
      player?.destroy();
      host.replaceChildren();
    };
  }, [playing, authFetch, watchUrl, video.youtubeId, video.seconds]);

  const tracked = !lesson.watched;
  const percent = Math.min(100, (furthest / Math.max(1, lesson.requiredSeconds)) * 100);

  return (
    <>
      <div className="relative mt-4 aspect-video w-full overflow-hidden rounded-xl bg-[#111]">
        {playing && <div ref={hostRef} className="absolute inset-0 [&_iframe]:size-full [&_iframe]:border-0" />}
        {playing && blocked && (
          <p className="absolute inset-0 grid place-items-center bg-[#111] p-6 text-center text-sm leading-[1.6] text-white" role="alert">
            {c.playerBlocked}
          </p>
        )}
        {!playing && (
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

      {tracked && (
        <div className="mt-3">
          <div
            className="h-1.5 overflow-hidden rounded-full bg-[#f1f1f1]"
            role="progressbar"
            aria-valuenow={Math.round(percent)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={c.watchProgress(formatClock(furthest), formatClock(video.seconds))}
          >
            <span className="block h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-1.5 flex flex-wrap justify-between gap-x-3 text-xs text-muted-foreground">
            <span className="font-semibold text-ink">{c.watchProgress(formatClock(furthest), formatClock(video.seconds))}</span>
            <span>{c.watchNeed(formatClock(lesson.requiredSeconds))}</span>
          </p>
          {seekBlocked && <p className="mt-1 text-xs font-semibold text-brand" role="status">{c.seekBlocked}</p>}
        </div>
      )}
      {!tracked && !lesson.completed && (
        <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-[#1e7d3a]" role="status">
          <CheckCircle2 aria-hidden="true" className="size-4" /> {c.watchDone}
        </p>
      )}
    </>
  );
}

// A loaded quiz, or the HTTP status of a failed load (0 for a network error), tagged with its lesson so a quiz from a
// previous lesson is never shown.
type LoadedQuiz = { lessonId: string; quiz: LessonQuiz; status?: undefined } | { lessonId: string; quiz: null; status: number };

export function QuizPanel({
  courseId,
  lesson,
  onCourseUpdated,
  onPassed,
  onRewatch,
  onStale,
  nextLesson,
  onNext,
  recordedBadge,
}: {
  courseId: string;
  lesson: CourseLesson;
  onCourseUpdated: (course: Course) => void;
  onPassed: () => void;
  /** Too many failed quizzes: the server reset the video, `course` shows it */
  onRewatch: (course: Course) => void;
  /** The server says the quiz is closed (the video was reset elsewhere): reload the course */
  onStale: () => void;
  nextLesson: CourseLesson | undefined;
  onNext?: () => void;
  recordedBadge?: string;
}) {
  const c = courseCopy;
  const authFetch = useAuthFetch();
  const quizUrl = `/api/courses/${courseId}/lessons/${lesson.id}/quiz`;
  const lessonId = lesson.id;
  const [loaded, setLoaded] = useState<LoadedQuiz | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  // Bumped on every load and on unmount; responses from an older request (or a lesson no longer shown) are ignored
  const requestRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const onStaleRef = useRef(onStale);
  useEffect(() => {
    onStaleRef.current = onStale;
  });
  const current = loaded?.lessonId === lessonId ? loaded : null;
  const quiz = current?.quiz ?? null;

  // Every GET returns a new random set of questions, so this also serves "try another set"
  const loadQuiz = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const request = ++requestRef.current;
    let next: LoadedQuiz;
    try {
      const response = await authFetch(quizUrl, { signal: controller.signal });
      const body = response.ok ? ((await response.json()) as LessonQuiz) : null;
      // An empty set cannot be passed; treat it like the server's "no questions for this lesson" (503)
      next = body && body.questions.length > 0
        ? { lessonId, quiz: body }
        : { lessonId, quiz: null, status: response.ok ? 503 : response.status };
    } catch {
      if (controller.signal.aborted) return;
      next = { lessonId, quiz: null, status: 0 };
    }
    if (request !== requestRef.current) return;
    if (next.status === 403) onStaleRef.current();
    setLoaded(next);
    setAnswers(next.quiz ? next.quiz.questions.map(() => null) : []);
    setResult(null);
    setError("");
    setBusy(false);
  }, [authFetch, quizUrl, lessonId]);

  useEffect(() => {
    void loadQuiz();
    return () => {
      requestRef.current += 1;
      abortRef.current?.abort();
    };
  }, [loadQuiz]);

  const reload = (message = "") => {
    setLoaded(null);
    setNotice(message);
    void loadQuiz();
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!quiz || busy || result) return;
    if (answers.some((answer) => answer === null)) {
      setError(c.answerRequired);
      return;
    }
    const request = requestRef.current;
    setBusy(true);
    setError("");
    setNotice("");
    let graded: QuizResult | null = null;
    let status = 0;
    try {
      const response = await authFetch(quizUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: quiz.token, answers }),
      });
      status = response.status;
      if (response.ok) graded = (await response.json()) as QuizResult;
    } catch {
      // Network error: status stays 0
    }
    const stale = request !== requestRef.current;
    if (graded?.passed) {
      // Pin the selection first so the updated nextLessonId does not move the screen; then store the new progress,
      // which the server recorded even if the learner has moved to another lesson meanwhile.
      if (!stale) onPassed();
      onCourseUpdated(graded.course);
    }
    if (stale) return;
    setBusy(false);
    if (graded) {
      setResult(graded);
      return;
    }
    // 409: the question bank changed since this quiz was issued; 400 with every question answered means the token was
    // rejected. Either way the learner needs a fresh set.
    if (status === 409 || status === 400) reload(c.quizStale);
    else if (status === 403) onStale();
    else setError(c.loadFailed);
  };

  // The grading response already carries the updated course, so the "recorded" note shows right away
  const badge = result?.course.completed ? result.course.badge : recordedBadge;

  return (
    <section className="mt-8 border-t border-line pt-6" aria-labelledby="course-quiz">
      <h2 id="course-quiz" className="flex items-center gap-2 text-lg font-bold text-ink">
        <BookOpenCheck aria-hidden="true" className="size-5 text-brand" /> {c.quizTitle}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{c.quizHint}</p>

      {notice && <p className="mt-3 rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-ink" role="status">{notice}</p>}

      {!current && <p className="mt-4 text-sm text-muted-foreground" role="status">{c.quizLoading}</p>}

      {current && !quiz && (
        <div className="mt-4">
          <p className="text-[15px] text-ink" role="alert">{current.status === 403 ? c.quizNeedsVideo : c.quizLoadFailed}</p>
          <Button type="button" variant="outline" onClick={() => reload()} className="mt-3 rounded-full">{c.retryLoad}</Button>
        </div>
      )}

      {quiz && (
        <form onSubmit={submit} className="mt-4 grid gap-5" noValidate>
          {quiz.questions.map((question, questionIndex) => {
            const graded = result?.results.find((item) => item.questionId === question.id);
            const selected = answers[questionIndex];
            return (
              <fieldset key={question.id}>
                <legend className="text-[15px] font-bold leading-[1.5] text-ink">
                  {questionIndex + 1}. {question.question}
                </legend>
                <div className="mt-2 grid gap-2">
                  {question.options.map((option, optionIndex) => {
                    // A failed quiz only marks the learner's own answers; the right ones come with a pass
                    const picked = graded !== undefined && selected === optionIndex;
                    const correct = graded !== undefined && (optionIndex === graded.correctIndex || (picked && graded.correct));
                    const wrong = picked && !graded.correct;
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
                          disabled={result !== null || busy}
                          onChange={() => setAnswers((current) => current.map((value, i) => (i === questionIndex ? optionIndex : value)))}
                          className="mt-0.5 accent-brand"
                        />
                        <span className="flex-1">{option}</span>
                        {correct && <CheckCircle2 aria-label={c.correctAnswer} className="mt-0.5 size-4.5 shrink-0 text-[#1e7d3a]" />}
                        {wrong && <XCircle aria-label={c.wrongAnswer} className="mt-0.5 size-4.5 shrink-0 text-brand" />}
                      </label>
                    );
                  })}
                </div>
                {graded && (graded.explanation || !graded.correct) && (
                  <p className={cn("mt-2 rounded-lg px-3 py-2 text-sm leading-[1.55]", graded.correct ? "bg-[#eef8f1] text-[#145c2a]" : "bg-[#fdf0ed] text-[#8a2412]")}>
                    {graded.explanation ?? c.wrongHint}
                  </p>
                )}
              </fieldset>
            );
          })}

          {error && <p className="text-sm font-semibold text-brand" role="alert">{error}</p>}

          {result && (
            <p className={cn("rounded-xl px-4 py-3 text-[15px] font-semibold leading-[1.5]", result.passed ? "bg-[#eef8f1] text-[#145c2a]" : "bg-[#fdf0ed] text-[#8a2412]")} role="status">
              {result.passed ? c.passed : c.failed(result.correctCount, result.total)}
              {!result.passed && result.attemptsLeft !== null && (
                <span className="mt-1 block text-sm font-normal">
                  {result.attemptsLeft > 0 ? c.attemptsLeft(result.attemptsLeft) : c.mustRewatch}
                </span>
              )}
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
            {result && !result.passed && result.attemptsLeft === 0 && (
              <Button type="button" onClick={() => onRewatch(result.course)} className="h-11 rounded-full font-bold">
                <PlayCircle aria-hidden="true" /> {c.rewatch}
              </Button>
            )}
            {result && !result.passed && result.attemptsLeft !== 0 && (
              <Button type="button" variant="outline" onClick={() => reload()} className="h-11 rounded-full font-semibold">
                <RotateCcw aria-hidden="true" /> {c.retry}
              </Button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
