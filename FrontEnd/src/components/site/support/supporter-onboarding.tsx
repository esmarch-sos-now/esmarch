"use client";

import { useState } from "react";
import { BookOpenCheck, CheckCircle2, ChevronUp, Clock3, Loader2, PauseCircle, Phone, PlayCircle, Send } from "lucide-react";
import CourseLearning from "@/components/site/courses/course-learning";
import { CompletedCourseChips } from "@/components/site/courses/completed-courses";
import { Button } from "@/components/ui/button";
import { courseCopy, formatCourseDate, onboardingCopy } from "@/content/app";
import { formatPhone } from "@/content/facilities";
import { useAuthFetch } from "@/hooks/use-auth";
import type { SupporterProfile } from "@/hooks/use-supporter";
import { cn } from "@/lib/utils";

type StepState = "done" | "current" | "next";

// The way to supporter mode, for a signed-in user who is not a verified supporter yet:
// 1. finish the courses, 2. apply (account phone + commitment), 3. wait for an admin. Each step's state comes from the
// backend's `status`, so the page cannot be talked into skipping one. The courses live here: they open under the steps
// when the user presses "Bắt đầu học" / "Học tiếp" (or "Xem lại khóa học" while waiting); there is no course page.
export default function SupporterOnboarding({
  profile,
  defaultName,
  onChanged,
}: {
  profile: SupporterProfile;
  defaultName: string;
  onChanged: (next: SupporterProfile) => void;
}) {
  const c = onboardingCopy;
  const [studying, setStudying] = useState(false);
  if (profile.status === "suspended") {
    return (
      <section className="mt-6 rounded-2xl border border-line bg-white p-5">
        <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
          <PauseCircle aria-hidden="true" className="size-5 text-muted-foreground" /> {c.suspendedTitle}
        </h2>
        <p className="mt-1.5 text-[15px] leading-[1.6] text-muted-foreground">{c.suspendedBody}</p>
      </section>
    );
  }

  const step = profile.status === "ready" ? 2 : profile.status === "pending" ? 3 : 1;
  const state = (index: number): StepState => (index < step ? "done" : index === step ? "current" : "next");

  return (
    <section className="mt-6 grid gap-4 rounded-2xl border border-line bg-white p-5" aria-labelledby="onboarding-title">
      <div>
        <h2 id="onboarding-title" className="text-xl font-black text-ink">{c.title}</h2>
        <p className="mt-1.5 text-[15px] leading-[1.6] text-muted-foreground">{c.intro}</p>
      </div>

      <ol className="grid gap-3">
        <Step index={1} title={c.steps.courses} state={state(1)}>
          {state(1) === "current" && <CoursesStep profile={profile} open={studying} onOpen={() => setStudying(true)} />}
          {state(1) === "done" && <CompletedCourseChips courses={profile.completedCourses} />}
        </Step>
        <Step index={2} title={c.steps.apply} state={state(2)}>
          {state(2) === "current" && <ApplyStep profile={profile} defaultName={defaultName} onApplied={onChanged} />}
        </Step>
        <Step index={3} title={c.steps.verify} state={state(3)}>
          {state(3) === "current" && (
            <div className="grid gap-1.5">
              <p className="text-[15px] font-bold text-ink">{c.pendingTitle}</p>
              <p className="text-sm leading-[1.6] text-muted-foreground">{c.pendingBody(formatCourseDate(profile.appliedAt))}</p>
              <p className="text-sm text-muted-foreground">
                {profile.displayName} · {formatPhone(profile.contactPhone ?? "")}
              </p>
              {!studying && (
                <Button variant="outline" onClick={() => setStudying(true)} className="mt-1 h-10 justify-self-start rounded-full [&_svg]:size-4">
                  <BookOpenCheck aria-hidden="true" /> {c.reviewCourses}
                </Button>
              )}
            </div>
          )}
        </Step>
      </ol>

      {studying && step !== 2 && (
        <section className="border-t border-line pt-4" aria-labelledby="onboarding-courses">
          <div className="flex items-center justify-between gap-3">
            <h3 id="onboarding-courses" className="text-lg font-black text-ink">{c.coursesTitle}</h3>
            <Button variant="ghost" size="sm" onClick={() => setStudying(false)} className="rounded-full text-muted-foreground">
              <ChevronUp aria-hidden="true" /> {c.hideCourses}
            </Button>
          </div>
          <CourseLearning />
        </section>
      )}
    </section>
  );
}

function Step({ index, title, state, children }: { index: number; title: string; state: StepState; children?: React.ReactNode }) {
  const c = onboardingCopy;
  return (
    <li
      className={cn(
        "grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 rounded-xl border p-4",
        state === "current" ? "border-brand bg-[#fff8f6]" : "border-line",
      )}
      aria-current={state === "current" ? "step" : undefined}
    >
      <span
        className={cn(
          "grid size-8 place-items-center rounded-full text-sm font-black",
          state === "done" ? "bg-[#1e9e4a] text-white" : state === "current" ? "bg-brand text-white" : "bg-[#f1f1f2] text-muted-foreground",
        )}
        aria-hidden="true"
      >
        {state === "done" ? <CheckCircle2 className="size-4.5" /> : state === "next" && index === 3 ? <Clock3 className="size-4" /> : index}
      </span>
      <div className="min-w-0 self-center">
        <p className={cn("font-bold", state === "next" ? "text-muted-foreground" : "text-ink")}>{title}</p>
        <p className="text-xs text-muted-foreground">{c.stepState[state]}</p>
      </div>
      {children && <div className="col-span-2 min-w-0 sm:col-start-2 sm:col-span-1">{children}</div>}
    </li>
  );
}

function CoursesStep({ profile, open, onOpen }: { profile: SupporterProfile; open: boolean; onOpen: () => void }) {
  const c = onboardingCopy;
  const { done, total, courses } = profile.courseProgress;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="grid gap-3">
      <div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-ink">{c.lessons(done, total)}</span>
          <span className="text-muted-foreground">{percent}%</span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#f1f1f2]" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
          <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${percent}%` }} />
        </div>
      </div>
      <ul className="grid gap-1.5">
        {courses.map((course) => (
          <li key={course.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2 text-ink">
              {course.completed ? (
                <CheckCircle2 aria-hidden="true" className="size-4 shrink-0 text-[#1e9e4a]" />
              ) : (
                <BookOpenCheck aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
              )}
              <span className="truncate">{course.title}</span>
            </span>
            <span className="shrink-0 text-muted-foreground">
              {course.completed ? c.courseDone : c.lessons(course.completedLessons, course.lessonCount)}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">{c.coursesHint}</p>
      {!open && (
        <Button onClick={onOpen} className="h-11 justify-self-start rounded-full px-5 font-bold [&_svg]:size-4.5">
          <PlayCircle aria-hidden="true" /> {done > 0 ? c.continue : c.start}
        </Button>
      )}
    </div>
  );
}

function ApplyStep({
  profile,
  defaultName,
  onApplied,
}: {
  profile: SupporterProfile;
  defaultName: string;
  onApplied: (next: SupporterProfile) => void;
}) {
  const c = onboardingCopy;
  const authFetch = useAuthFetch();
  const [name, setName] = useState(defaultName);
  const [commitment, setCommitment] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  if (!profile.accountPhone) return <p className="text-sm text-brand">{c.noPhone}</p>;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!commitment) return setError(c.needCommitment);
    setSending(true);
    try {
      const response = await authFetch("/api/support/me/application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: name.trim() || null, commitment: true }),
      });
      if (response.ok) return onApplied((await response.json()) as SupporterProfile);
      const detail = await response.json().then((body: { detail?: unknown }) => String(body?.detail ?? ""), () => "");
      setError(detail || c.failed);
    } catch {
      setError(c.failed);
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-3.5" noValidate>
      <p className="text-[15px] font-semibold text-ink">{c.readyTitle}</p>
      <CompletedCourseChips courses={profile.completedCourses} label={courseCopy.earned} />
      <label className="grid gap-1.5">
        <span className="text-sm font-bold text-ink">{c.name}</span>
        <input
          value={name}
          maxLength={100}
          onChange={(event) => setName(event.target.value)}
          className="h-11 rounded-xl border border-line bg-white px-3.5 text-base outline-none focus:border-brand"
        />
      </label>
      <div className="grid gap-1.5">
        <span className="text-sm font-bold text-ink">{c.phone}</span>
        <p className="flex h-11 items-center gap-2 rounded-xl border border-line bg-[#f6f6f6] px-3.5 text-base text-ink">
          <Phone aria-hidden="true" className="size-4 text-muted-foreground" /> {formatPhone(profile.accountPhone)}
        </p>
        <span className="text-xs text-muted-foreground">{c.phoneHint}</span>
      </div>
      <label className="flex cursor-pointer items-start gap-2.5 text-sm leading-[1.55] text-ink">
        <input
          type="checkbox"
          checked={commitment}
          onChange={(event) => setCommitment(event.target.checked)}
          className="mt-0.5 size-4.5 shrink-0 accent-brand"
        />
        {c.commitment}
      </label>
      {error && (
        <p className="text-sm font-semibold text-brand" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={sending} className="h-11 justify-self-start rounded-full px-5 font-bold [&_svg]:size-4">
        {sending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Send aria-hidden="true" />} {sending ? c.submitting : c.submit}
      </Button>
    </form>
  );
}
