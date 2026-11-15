"use client";

import Link from "next/link";
import { ArrowRight, Award, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { courseCopy, formatCourseDate } from "@/content/app";
import { useSupporterProfile } from "@/hooks/use-supporter";
import type { CompletedCourse } from "@/lib/courses/types";
import { cn } from "@/lib/utils";

const COURSE_PATH = "/app/khoa-hoc";
const RESPONDER_PATH = "/app/san-sang-ho-tro";

/** Small green chips with the badges of finished first-aid courses (responder and requester screens). */
export function CompletedCourseChips({ courses, label, className }: { courses: CompletedCourse[]; label?: string; className?: string }) {
  if (courses.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {label && <span className="text-xs font-semibold text-muted-foreground">{label}</span>}
      <ul className="contents">
        {courses.map((course) => (
          <li
            key={course.id}
            title={course.badge}
            className="inline-flex items-center gap-1 rounded-full border border-[#cdebd6] bg-[#eef8f1] px-2.5 py-1 text-xs font-semibold text-[#1e7d3a]"
          >
            <CheckCircle2 aria-hidden="true" className="size-3.5 shrink-0" /> {course.title}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "Khóa học sơ cứu" card on the account page: the courses recorded on the responder's profile. */
export function CourseRecordCard() {
  const c = courseCopy.profile;
  const profile = useSupporterProfile();
  const completed = profile.data?.completedCourses ?? [];
  // Not a supporter yet (and not waiting for one): point to the way there
  const invite = profile.data && ["none", "learning", "ready"].includes(profile.data.status);

  return (
    <Card className="w-full rounded-3xl [--card-spacing:--spacing(6)]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl font-bold text-ink">
          <Award aria-hidden="true" className="size-5 text-brand" /> {c.title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {profile.isLoading && <p className="text-sm text-muted-foreground">{c.loading}</p>}
        {profile.error && <p className="text-sm text-muted-foreground">{c.loadFailed}</p>}

        {profile.data && completed.length === 0 && (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] text-muted-foreground">
            {c.none}
            <Link href={COURSE_PATH} className="inline-flex items-center gap-1 font-semibold text-brand hover:underline">
              {c.start} <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </p>
        )}

        {profile.data && completed.length > 0 && (
          <ul className="grid gap-2">
            {completed.map((course) => {
              const date = formatCourseDate(course.completedAt);
              return (
                <li key={course.id} className="flex items-start gap-3 rounded-xl border border-[#cdebd6] bg-[#f1fbf4] px-3.5 py-2.5">
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-[#1e7d3a]" />
                  <span className="min-w-0">
                    <span className="block text-[15px] leading-[1.45] font-bold text-[#145c2a]">{course.badge}</span>
                    {date && <span className="block text-xs text-muted-foreground">{c.completedOn(date)}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {invite && (
          <p className="mt-3 text-sm text-muted-foreground">
            {c.supporter}{" "}
            <Link href={RESPONDER_PATH} className="font-semibold text-brand hover:underline">{c.becomeSupporter}</Link>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
