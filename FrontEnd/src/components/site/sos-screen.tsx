"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { HandHeart, Phone } from "lucide-react";
import Navbar from "@/components/site/landing/Navbar";
import { Page } from "@/components/site/primitives";
import { appNav, sosScreen } from "@/content/app";

const ring = "absolute inset-[14%] animate-sos-wave rounded-full bg-[rgba(234,84,85,.14)] motion-reduce:animate-none motion-reduce:opacity-50";

// Màn hình Nút SOS: nhấn nút chuyển sang màn Cơ sở y tế gần nhất và mở hộp Gọi 115 / Hủy (bản demo không gọi thật)
export default function SosScreen() {
  const router = useRouter();

  return (
    <Page>
      <Navbar appLinks={appNav} />
      <main className="flex min-h-[calc(100svh-68px)] flex-col items-center px-4 pt-10 pb-12 text-center max-lg:min-h-[calc(100svh-56px)]">
        <h1 className="text-[clamp(28px,4vw,44px)] leading-[1.15] font-black tracking-[-.01em] text-ink">{sosScreen.question}</h1>
        <p className="mt-3 max-w-115 text-base leading-[1.55] text-muted-foreground">{sosScreen.hint}</p>

        <div className="relative mt-[clamp(24px,5vh,48px)] mb-[clamp(16px,3vh,28px)] grid aspect-square w-[min(360px,86vw)] place-items-center">
          <span className={ring} aria-hidden="true" />
          <span className={`${ring} [animation-delay:.85s]`} aria-hidden="true" />
          <span className={`${ring} [animation-delay:1.7s]`} aria-hidden="true" />
          {/* ?sos=1 opens the call dialog on the facilities screen (no coordinates in the URL) */}
          <button
            type="button"
            onClick={() => router.push("/app/co-so-y-te?sos=1")}
            aria-label={sosScreen.buttonLabel}
            className="relative grid aspect-square w-[62%] cursor-pointer place-items-center rounded-full bg-[linear-gradient(160deg,#e5484d,#f07b7b)] text-[clamp(40px,7vw,58px)] leading-none font-black tracking-[.04em] text-white shadow-[0_18px_40px_rgba(229,72,77,.45),inset_0_-6px_0_rgba(0,0,0,.08)] transition-[scale,box-shadow] duration-150 [-webkit-tap-highlight-color:transparent] hover:scale-103 hover:shadow-[0_22px_48px_rgba(229,72,77,.5),inset_0_-6px_0_rgba(0,0,0,.08)] focus-visible:outline-4 focus-visible:outline-offset-6 focus-visible:outline-brand-yellow active:scale-96 motion-reduce:transition-none"
          >
            {sosScreen.button}
          </button>
        </div>

        <p className="inline-flex items-center gap-2 text-lg font-bold text-brand [&_svg]:size-5"><Phone aria-hidden="true" /> {sosScreen.buttonLabel}</p>
        <p className="mt-2 text-[13px] leading-normal text-muted-foreground">{sosScreen.note}</p>
        {/* Gửi tín hiệu tới người biết sơ cứu trong bán kính 3 km */}
        <Link
          href="/app/nguoi-ho-tro"
          className="mt-6 inline-flex items-center gap-2 rounded-full border border-line bg-white px-5 py-2.5 text-[15px] font-bold text-ink no-underline shadow-[0_6px_18px_rgba(0,0,0,.06)] transition-colors hover:border-brand hover:text-brand [&_svg]:size-4.5"
        >
          <HandHeart aria-hidden="true" /> {sosScreen.findHelper}
        </Link>
      </main>
    </Page>
  );
}
