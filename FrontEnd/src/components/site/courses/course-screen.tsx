"use client";

import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, LogIn } from "lucide-react";
import CourseLearning from "@/components/site/courses/course-learning";
import Navbar from "@/components/site/landing/Navbar";
import { Page } from "@/components/site/primitives";
import { Button } from "@/components/ui/button";
import { appNav, courseCopy } from "@/content/app";
import { useSession } from "@/hooks/use-auth";
import { useSupporterProfile } from "@/hooks/use-supporter";
import { SUPPORTER_PATH } from "@/lib/auth/paths";

const LOGIN_NEXT = "/dang-nhap?next=%2Fapp%2Fkhoa-hoc";

// The course page (/app/khoa-hoc): "Bắt đầu học" / "Học tiếp" / "Xem lại khóa học" on the supporter page lead here,
// and the link at the top leads back there. Each lesson's quiz is on its own page (course-quiz-screen.tsx).
export default function CourseScreen() {
  const c = courseCopy;
  const { status } = useSession();
  const supporter = useSupporterProfile();
  const backLabel = supporter.data?.status === "verified" ? c.backToSupport : c.backToSignup;

  return (
    <Page>
      <Navbar appLinks={appNav} />
      <main className="mx-auto w-full max-w-180 px-4 pt-7 pb-12">
        <Link
          href={SUPPORTER_PATH}
          className="inline-flex items-center gap-1.5 rounded-full text-sm font-semibold text-muted-foreground hover:text-brand [&_svg]:size-4"
        >
          <ArrowLeft aria-hidden="true" /> {backLabel}
        </Link>
        <h1 className="mt-3 text-[clamp(28px,4vw,40px)] leading-[1.15] font-black tracking-[-.01em] text-ink">{c.title}</h1>

        {status === "loading" && <p className="mt-6 text-sm text-muted-foreground">{c.loading}</p>}

        {status === "unauthenticated" && (
          <section className="mt-6">
            <p className="text-[15px] text-ink">{c.signIn}</p>
            <Button asChild className="mt-4 h-11 rounded-full px-5 font-bold [&_svg]:size-4.5">
              <Link href={LOGIN_NEXT}>
                <LogIn aria-hidden="true" /> {c.signInButton}
              </Link>
            </Button>
          </section>
        )}

        {/* useSearchParams (?khoa=&bai=, the way back from a quiz) needs a Suspense boundary for static prerendering */}
        {status === "authenticated" && (
          <Suspense>
            <CourseLearning />
          </Suspense>
        )}
      </main>
    </Page>
  );
}
