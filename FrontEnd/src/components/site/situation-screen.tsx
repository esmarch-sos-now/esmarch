"use client";

import { useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUp, Bone, Languages, Mic, Phone, Square, UserRound, Users, Wind, type LucideIcon } from "lucide-react";
import AppNav from "@/components/site/app-nav";
import { Page } from "@/components/site/primitives";
import { situationScreen as s } from "@/content/app";
import { guideForText, guides3d } from "@/content/guides3d";
import { cn } from "@/lib/utils";
import { speechCtor, type BrowserSpeech } from "@/lib/voice/speech";

// Quả cầu: các mảng màu mờ chồng lên nhau, đổi dáng và xoay chậm (animate-orb-* trong globals.css)
const ORB =
  "radial-gradient(circle at 28% 26%, #ffd27a 0, transparent 45%), radial-gradient(circle at 76% 30%, #ff8fc0 0, transparent 46%), radial-gradient(circle at 70% 78%, #c2185b 0, transparent 50%), radial-gradient(circle at 30% 76%, #ff3a2d 0, transparent 55%), radial-gradient(circle at 55% 50%, #ff7a55 0, #f2552f 72%)";
const GLOW = "radial-gradient(circle, rgba(255,90,60,.45), rgba(255,158,192,.25) 55%, transparent 72%)";

// Người bất tỉnh hoặc ngừng thở chưa có hướng dẫn đã duyệt: nhắc gọi 115 thay vì mở một hướng dẫn không khớp
const URGENT_WORDS = ["bất tỉnh", "ngất", "ngừng thở", "không thở", "bat tinh", "ngung tho", "khong tho"];
const isUrgent = (text: string) => URGENT_WORDS.some((word) => text.toLowerCase().normalize("NFC").includes(word));

type Chip = { label: string; Icon: LucideIcon; href?: string };
const GUIDE_ICONS: Record<string, LucideIcon> = { "ep-bung": Wind, "gay-xuong-dui": Bone, "xuc-thia": Users };
const CHIPS: Chip[] = [
  { label: s.unconscious, Icon: UserRound },
  ...guides3d.map((guide) => ({ label: guide.label, Icon: GUIDE_ICONS[guide.id] ?? Users, href: guide.path })),
];
// Vị trí quanh quả cầu (từ màn hình vừa trở lên); màn hẹp thì xếp thành hàng dưới quả cầu
const CHIP_PLACES = ["sm:top-6 sm:left-[4%]", "sm:top-14 sm:right-[2%]", "sm:bottom-12 sm:left-0", "sm:bottom-6 sm:right-[6%]"];

type Notice = "urgent" | "notFound" | "micFailed" | null;

// Giờ của máy người dùng; trang được dựng sẵn nên lúc dựng (server) chưa có lời chào
const noSubscribe = () => () => {};
function useHour(): number | null {
  return useSyncExternalStore(noSubscribe, () => new Date().getHours(), () => null);
}

export default function SituationScreen() {
  const router = useRouter();
  const hour = useHour();
  const [text, setText] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [listening, setListening] = useState(false);
  const speech = useRef<BrowserSpeech | null>(null);

  // Nửa đêm tới 4 giờ vẫn là "buổi tối"
  const greeting =
    hour === null ? "" : hour >= 5 && hour < 12 ? s.greeting.morning : hour >= 12 && hour < 18 ? s.greeting.afternoon : s.greeting.evening;

  // Có hướng dẫn khớp thì mở ngay; người bất tỉnh thì nhắc gọi 115; còn lại gợi ý chọn hoặc hỏi trợ lý
  function ask(value: string) {
    const guide = guideForText(value);
    if (guide) return router.push(guide.path);
    setNotice(isUrgent(value) ? "urgent" : "notFound");
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (text.trim().length >= 2) ask(text);
  }

  // Micro: nhận lời nói ngay trong trình duyệt (tiếng Việt) rồi tìm hướng dẫn như khi gõ; trình duyệt không hỗ trợ thì
  // chuyển sang trợ lý sơ cứu bằng giọng nói
  function toggleMic() {
    if (listening) return speech.current?.stop();
    const Ctor = speechCtor();
    if (!Ctor) return router.push("/app/tro-ly");
    const recognition = new Ctor();
    recognition.lang = "vi-VN";
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const heard = event.results[0]?.[0]?.transcript ?? "";
      setText(heard);
      if (heard.trim()) ask(heard);
    };
    recognition.onerror = () => setNotice("micFailed");
    recognition.onend = () => setListening(false);
    speech.current = recognition;
    setNotice(null);
    setListening(true);
    recognition.start();
  }

  return (
    <Page>
      <AppNav />
      <main className="mx-auto flex w-full max-w-230 flex-col items-center px-4 pt-6 pb-10 text-center">
        <h1 className="sr-only">{s.title}</h1>

        <div className="relative grid w-full max-w-160 place-items-center pt-44 sm:h-80 sm:pt-0">
          <span
            className="absolute inset-x-0 top-4 mx-auto size-36 scale-150 animate-orb-glow rounded-[44%_56%_58%_42%/46%_44%_56%_54%] blur-[28px] sm:inset-0 sm:m-auto sm:size-44 motion-reduce:animate-none"
            style={{ background: GLOW }}
            aria-hidden="true"
          />
          <span
            className={cn(
              "absolute inset-x-0 top-4 mx-auto size-36 animate-orb-morph rounded-[44%_56%_58%_42%/46%_44%_56%_54%] blur-[7px] saturate-[1.15] sm:inset-0 sm:m-auto sm:size-44 motion-reduce:animate-none",
              listening && "[animation-duration:2s]",
            )}
            style={{ background: ORB }}
            aria-hidden="true"
          />
          <ul className="relative flex flex-wrap justify-center gap-2 sm:absolute sm:inset-0 sm:block" aria-label="Tình huống gợi ý">
            {CHIPS.map(({ label, Icon, href }, index) => {
              const chip =
                "inline-flex items-center gap-2 rounded-full border border-line bg-white/90 px-3.5 py-2 text-[15px] font-semibold text-ink no-underline shadow-[0_6px_16px_rgba(0,0,0,.06)] transition-colors hover:border-brand hover:text-brand [&_svg]:size-4 [&_svg]:text-brand";
              return (
                <li
                  key={label}
                  className={cn("sm:absolute sm:animate-chip-float motion-reduce:animate-none", CHIP_PLACES[index])}
                  style={{ animationDelay: `${index * -0.8}s` }}
                >
                  {href ? (
                    <Link href={href} className={chip}>
                      <Icon aria-hidden="true" /> {label}
                    </Link>
                  ) : (
                    <button type="button" className={cn(chip, "cursor-pointer")} onClick={() => setNotice("urgent")}>
                      <Icon aria-hidden="true" /> {label}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <div aria-live="polite" className="mt-6 sm:mt-2">
          <p className="min-h-6 text-lg font-medium text-brand">{listening ? s.listening : greeting}</p>
          <p className="mt-1 text-[clamp(26px,3.4vw,38px)] leading-[1.2] font-black tracking-[-.01em] text-[#4a4a4a]">{s.question}</p>
        </div>

        <form
          onSubmit={submit}
          className="mt-6 w-full max-w-160 rounded-[20px] border border-line bg-white px-4 pt-3 pb-2.5 text-left shadow-[0_8px_24px_rgba(0,0,0,.04)] focus-within:border-brand/60"
        >
          <textarea
            rows={2}
            value={text}
            maxLength={500}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) submit(event);
            }}
            placeholder={s.inputPlaceholder}
            aria-label={s.inputPlaceholder}
            className="w-full resize-none border-0 bg-transparent text-[15px] leading-normal text-ink outline-none placeholder:text-[#9a9a9a]"
          />
          <div className="mt-1 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[14px] text-[#555] [&_svg]:size-4">
              <Languages aria-hidden="true" /> {s.language}
            </span>
            <button
              type="button"
              onClick={toggleMic}
              aria-label={listening ? s.stopLabel : s.micLabel}
              aria-pressed={listening}
              className={cn(
                "ml-auto grid size-10 cursor-pointer place-items-center rounded-full text-brand transition-colors [&_svg]:size-4.5",
                listening ? "animate-sos-ring bg-brand text-white" : "bg-brand-soft hover:bg-brand/15",
              )}
            >
              {listening ? <Square aria-hidden="true" /> : <Mic aria-hidden="true" />}
            </button>
            <button
              type="submit"
              aria-label={s.sendLabel}
              disabled={text.trim().length < 2}
              className="grid size-10 cursor-pointer place-items-center rounded-full bg-brand text-white transition-colors hover:bg-brand-dark disabled:cursor-default disabled:opacity-60 [&_svg]:size-4.5"
            >
              <ArrowUp aria-hidden="true" />
            </button>
          </div>
        </form>

        {notice && (
          <div
            role="status"
            className={cn(
              "mt-4 w-full max-w-160 rounded-2xl border px-4 py-3 text-left text-[15px] leading-normal",
              notice === "urgent" ? "border-brand bg-brand-soft text-ink" : "border-line bg-white text-ink",
            )}
          >
            <p>{s[notice]}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href="tel:115" className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-bold text-white no-underline hover:bg-brand-dark [&_svg]:size-4">
                <Phone aria-hidden="true" /> {s.call115}
              </a>
              {notice !== "urgent" && (
                <Link href="/app/tro-ly" className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-4 py-2 text-sm font-bold text-ink no-underline hover:border-brand hover:text-brand [&_svg]:size-4">
                  <Mic aria-hidden="true" /> {s.askAssistant}
                </Link>
              )}
            </div>
          </div>
        )}

        <a href="tel:115" className="mt-5 inline-flex items-center gap-2 text-[16px] font-bold text-brand no-underline hover:underline [&_svg]:size-4.5">
          <Phone aria-hidden="true" /> {s.emergency}
        </a>
      </main>
    </Page>
  );
}
