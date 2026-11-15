"use client";

import useSWR from "swr";
import { useAuthFetch, useSession } from "@/hooks/use-auth";
import type { CompletedCourse } from "@/lib/courses/types";

/** Where the signed-in user stands on the way to supporter mode (decided by the backend, GET /api/support/me). */
export type SupporterStatus = "none" | "learning" | "ready" | "pending" | "verified" | "suspended";

export type RequiredCourse = {
  id: string;
  title: string;
  completed: boolean;
  completedLessons: number;
  lessonCount: number;
  nextLessonId: string | null;
};

export type SupporterProfile = {
  status: SupporterStatus;
  courseProgress: { done: number; total: number; complete: boolean; courses: RequiredCourse[] };
  completedCourses: CompletedCourse[];
  accountPhone: string | null;
  // Once the user has applied:
  displayName?: string;
  contactPhone?: string;
  skills?: string[];
  appliedAt?: string | null;
  available?: boolean;
};

/** One cache entry for every screen (supporter page, courses, account card, menu): a change shows everywhere. */
export const SUPPORTER_KEY = "support-profile";

export function useSupporterProfile() {
  const { user } = useSession();
  const authFetch = useAuthFetch();
  return useSWR<SupporterProfile>(user ? SUPPORTER_KEY : null, async () => {
    const response = await authFetch("/api/support/me");
    if (!response.ok) throw new Error(String(response.status));
    return (await response.json()) as SupporterProfile;
  });
}
