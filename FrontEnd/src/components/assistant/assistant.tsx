"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import Link from "next/link";
import { ArrowLeft, History, MicOff, Phone, PhoneOff, X } from "lucide-react";
import { useVoiceCall, type Mode } from "@/hooks/useVoiceCall";
import { PHASE_LABEL } from "@/lib/voice/protocol";
import { assistantScreen } from "@/content/app";
import { cn } from "@/lib/utils";
import ChatHistory from "./chat-history";
import StepOverlay from "./step-overlay";
import VoiceOrb from "./voice-orb";
import VoiceVisualizer, { type Tone } from "./voice-visualizer";

const MODE_LABEL: Record<Mode, string> = {
  idle: "Đang chờ",
  listening: "Đang nghe",
  thinking: "Đang suy nghĩ…",
  speaking: "Đang nói",
};

// The first-aid voice assistant: the demo's full-screen dark layout, a hero with the orb until a guide opens,
// then the 3D guide on stage with the orb docked underneath.
export default function Assistant() {
  const frame = useRef<HTMLIFrameElement>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  // On a wide screen the transcript opens beside the guide when the call connects (the dock itself has no text).
  const call = useVoiceCall(frame, () => {
    if (window.matchMedia("(min-width: 900px)").matches) setHistoryOpen(true);
  });

  const { status, mode, step, meters } = call;

  const live = status === "live";
  const connecting = status === "connecting";
  const speaking = live && mode === "speaking";
  const listening = live && mode === "listening" && call.micOn;
  const tone: Tone = speaking ? "assistant" : listening ? "user" : "idle";
  const bands = speaking ? meters.assistant.bands : meters.user.bands;
  const level = speaking ? meters.assistant.level : listening ? meters.user.level : () => 0;

  const lastAssistant = call.lines.findLast((line) => line.speaker === "assistant")?.text;
  const lastUser = call.lines.findLast((line) => line.speaker === "user")?.text;
  const caption = live ? lastAssistant : status === "ended" ? assistantScreen.ended : undefined;

  const hold = live && call.talkMode === "hold";
  const holdLabel = call.micOn ? assistantScreen.holdActive : assistantScreen.holdLabel;
  const statusText = call.reconnecting
    ? assistantScreen.reconnecting
    : hold
      ? call.micOn
        ? assistantScreen.holdActive
        : mode === "speaking" || mode === "thinking"
          ? MODE_LABEL[mode]
          : assistantScreen.holdIdle
      : call.micOn
        ? MODE_LABEL[mode]
        : "Micro đang tắt";

  // Pointer capture keeps the press alive when a finger slides off the button; release, cancel and lost capture end it.
  const onHoldDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    call.holdStart();
  };
  const onHoldKey = (event: KeyboardEvent<HTMLButtonElement>, down: boolean) => {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault(); // also stops the button's own click
    if (!down) call.holdEnd();
    else if (!event.repeat) call.holdStart();
  };

  const onOrb = () => {
    if (hold) return;
    if (live) call.toggleMic();
    else if (!connecting) void call.start();
  };

  // Layout: a hero with the orb until a guide opens, then the 3D guide on stage with the controls docked.
  // From 900px wide the stage fills the screen and the controls float as a pill in the bottom-right corner.
  const dock = Boolean(step);
  const noisy = call.noisy;
  // Captions are a little larger in noisy places, to read instead of listen.
  const captionSize = dock
    ? noisy
      ? "text-[clamp(17px,2.2vw,21px)] min-[900px]:text-[clamp(17px,1.5vw,19px)]"
      : "text-[clamp(14px,1.8vw,17px)] min-[900px]:text-[clamp(14px,1.3vw,16px)]"
    : noisy
      ? "text-[clamp(26px,3.8vw,36px)]"
      : "text-[clamp(22px,3.2vw,30px)]";
  const captionClamp = dock ? "line-clamp-2" : "line-clamp-3";
  const pillLink = cn(
    "inline-flex items-center gap-1.75 rounded-full text-sm font-semibold [&_svg]:size-4.25",
    dock ? "min-h-8.5 px-3 text-[13px]" : "min-h-10 px-3.5",
  );
  const iconButton = "grid size-11 cursor-pointer place-items-center rounded-full text-[#a1a1aa] hover:text-[#f4f4f5] aria-pressed:text-[#f4f4f5] [&_svg]:size-5";
  const notice = "max-w-115 rounded-xl border px-3.5 py-2.5 text-sm leading-[1.45]";

  return (
    <div
      data-layout={dock ? "dock" : "hero"}
      data-noisy={noisy || undefined}
      className={cn(
        "fixed inset-0 z-100 flex flex-col overflow-clip bg-[#0d1015] text-base text-[#f4f4f5]",
        "[&_:is(button,a):focus-visible]:outline-3 [&_:is(button,a):focus-visible]:outline-offset-2 [&_:is(button,a):focus-visible]:outline-brand-yellow",
        // Wide dock: fade the top of the 3D stage so the header and step bar stay readable.
        dock &&
          "min-[900px]:before:pointer-events-none min-[900px]:before:absolute min-[900px]:before:inset-x-0 min-[900px]:before:top-0 min-[900px]:before:z-2 min-[900px]:before:h-32.5 min-[900px]:before:bg-linear-to-b min-[900px]:before:from-[rgba(13,16,21,.88)] min-[900px]:before:to-transparent min-[900px]:before:content-['']",
      )}
    >
      <header className={cn("relative z-3 flex flex-none items-center justify-between gap-3 px-[max(16px,env(safe-area-inset-left))]", dock ? "pt-2 pb-1" : "py-3")}>
        <Link className={cn(pillLink, "text-[#a1a1aa] hover:text-[#f4f4f5]")} href="/app/sos">
          <ArrowLeft aria-hidden="true" /> <span>Thoát</span>
        </Link>
        <a
          className={cn(pillLink, "bg-[#e11d48] text-white hover:bg-[#be123c] data-urgent:animate-pulse-115 data-urgent:shadow-[0_0_0_3px_rgba(255,255,255,.85)] motion-reduce:animate-none")}
          href="tel:115"
          data-urgent={call.urgent || undefined}
        >
          <Phone aria-hidden="true" /> Gọi 115
        </a>
      </header>

      {step ? (
        <>
          <StepOverlay step={step} onSelect={call.selectStep} />
          {/* The 3D guide is a standalone page that narrates itself; the sandbox lets it run scripts and nothing else. */}
          <iframe
            ref={frame}
            key={step.guideId}
            className="relative z-1 min-h-0 w-full flex-1 border-0 bg-[#e6ebf0] min-[900px]:absolute min-[900px]:inset-0 min-[900px]:z-0 min-[900px]:h-full"
            src={`/guides/${step.file}`}
            title={step.title}
            sandbox="allow-scripts"
            allow="autoplay; fullscreen"
            onLoad={call.onFrameLoad}
          />
        </>
      ) : (
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(200,16,46,.16),transparent_60%)]" aria-hidden="true" />
      )}

      <div
        className={cn(
          "relative z-3 flex flex-col items-center px-4 pb-[max(18px,env(safe-area-inset-bottom))] text-center",
          dock
            ? cn(
                "flex-none gap-2 border-t border-white/8 bg-[#0d1015] pt-2.5 pb-[max(12px,env(safe-area-inset-bottom))]",
                "min-[900px]:absolute min-[900px]:right-4 min-[900px]:bottom-3.5 min-[900px]:z-4 min-[900px]:m-0 min-[900px]:w-auto min-[900px]:flex-row min-[900px]:gap-2.5 min-[900px]:rounded-full min-[900px]:border min-[900px]:border-white/10 min-[900px]:bg-[rgba(13,16,21,.72)] min-[900px]:px-3.5 min-[900px]:py-2 min-[900px]:shadow-[0_12px_36px_rgba(0,0,0,.35)] min-[900px]:backdrop-blur-[16px]",
              )
            : "flex-1 justify-center gap-6",
        )}
      >
        {/* On the wide dock the AI part is just orb, bars and end button; the words are in the transcript panel. */}
        <div className={cn("flex max-w-170 flex-col items-center gap-2", dock && "min-[900px]:hidden")} aria-live="polite">
          {caption ? (
            <p className={cn("leading-[1.35] font-medium text-balance", captionClamp, captionSize)}>{caption}</p>
          ) : (
            !live && (
              <>
                <h1 className="text-[clamp(30px,5vw,40px)] leading-[1.15] font-semibold tracking-[-.01em]">{assistantScreen.title}</h1>
                <p className={cn("max-w-110 leading-normal text-balance text-[#a1a1aa]", captionClamp, captionSize)}>{assistantScreen.lede}</p>
              </>
            )
          )}
          {live && lastUser && <p className={cn("line-clamp-1 leading-[1.4] text-[rgba(165,243,252,.8)]", captionSize)}>Bạn: {lastUser}</p>}
        </div>

        <div className={cn("flex items-center justify-center gap-3.5 sm:gap-5", !dock && "gap-7 sm:gap-7", dock && "min-[900px]:gap-3")}>
          <button
            type="button"
            className={cn(iconButton, !live && call.lines.length === 0 && "invisible")}
            onClick={() => setHistoryOpen((open) => !open)}
            aria-label="Lịch sử trò chuyện"
            aria-pressed={historyOpen}
          >
            <History aria-hidden="true" />
          </button>
          <VoiceVisualizer bands={bands} tone={tone} mirror className={cn("hidden sm:flex", dock && "h-9 min-[900px]:h-7")} />
          <button
            type="button"
            className={cn(
              "relative flex-none cursor-pointer rounded-full",
              dock ? "size-16 max-[599px]:size-14 min-[900px]:size-13" : "size-[clamp(160px,28vw,208px)]",
              hold && "touch-none select-none [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none] aria-pressed:shadow-[0_0_0_4px_rgba(103,232,249,.55)]",
            )}
            onClick={onOrb}
            data-hold={hold || undefined}
            aria-pressed={hold ? call.micOn : undefined}
            aria-label={hold ? holdLabel : live ? (call.micOn ? "Tắt micro" : "Bật micro") : "Gọi trợ lý sơ cứu"}
            onPointerDown={hold ? onHoldDown : undefined}
            onPointerUp={hold ? call.holdEnd : undefined}
            onPointerCancel={hold ? call.holdEnd : undefined}
            onLostPointerCapture={hold ? call.holdEnd : undefined}
            onBlur={hold ? call.holdEnd : undefined}
            onKeyDown={hold ? (event) => onHoldKey(event, true) : undefined}
            onKeyUp={hold ? (event) => onHoldKey(event, false) : undefined}
            onContextMenu={hold ? (event) => event.preventDefault() : undefined}
          >
            <VoiceOrb mode={live ? mode : "idle"} level={level} />
            {live && !hold && !call.micOn && <MicOff className="absolute top-1/2 left-1/2 size-6.5 -translate-1/2 text-[#f4f4f5]" aria-hidden="true" />}
          </button>
          <VoiceVisualizer bands={bands} tone={tone} className={cn("hidden sm:flex", dock && "h-9 min-[900px]:h-7")} />
          <span className="block w-11" aria-hidden="true" />
        </div>

        {live ? (
          <div className={cn("flex items-center gap-3 text-sm text-[#71717a]", dock && "text-[13px] min-[900px]:gap-0")}>
            <span className={cn(dock && "min-[900px]:hidden")}>
              {statusText}
              {call.phase && ` · ${PHASE_LABEL[call.phase]}`}
            </span>
            <button
              type="button"
              onClick={call.end}
              aria-label="Kết thúc cuộc gọi"
              className={cn(
                "inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full bg-[#be123c] px-3.5 text-[13px] font-semibold text-white hover:bg-[#e11d48] [&_svg]:size-4",
                dock && "min-[900px]:min-h-10 min-[900px]:w-10 min-[900px]:justify-center min-[900px]:p-0",
              )}
            >
              <PhoneOff aria-hidden="true" /> <span className={cn(dock && "min-[900px]:hidden")}>Kết thúc</span>
            </button>
          </div>
        ) : (
          <div className={cn("flex flex-col items-center gap-3", dock && "min-[900px]:hidden")}>
            <button
              type="button"
              onClick={onOrb}
              disabled={connecting}
              className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-full bg-[#e11d48] px-6 text-base font-semibold text-white hover:not-disabled:bg-[#f43f5e] disabled:cursor-progress disabled:opacity-70 [&_svg]:size-4.75"
            >
              <Phone aria-hidden="true" />
              {connecting ? "Đang kết nối…" : status === "idle" ? assistantScreen.start : assistantScreen.again}
            </button>
            <p className={cn("max-w-115 text-xs leading-normal text-[#71717a]", dock && "hidden")}>{assistantScreen.consent}</p>
          </div>
        )}

        {live && (
          <div className="inline-flex rounded-full bg-white/8 p-0.75" role="group" aria-label={assistantScreen.talkModeLabel}>
            {[
              { pressed: !hold, mode: "open" as const, label: assistantScreen.talkFree },
              { pressed: hold, mode: "hold" as const, label: assistantScreen.talkHold },
            ].map((option) => (
              <button
                key={option.mode}
                type="button"
                aria-pressed={option.pressed}
                onClick={() => call.setTalkMode(option.mode)}
                className="min-h-8.5 cursor-pointer rounded-full px-3 text-[13px] font-semibold text-[#a1a1aa] aria-pressed:bg-white/16 aria-pressed:text-[#f4f4f5]"
              >
                {option.label}
              </button>
            ))}
          </div>
        )}

        {live && call.noiseHint && (
          <div className={cn(notice, "flex items-center gap-2.5 border-[rgba(251,191,36,.4)] bg-[rgba(251,191,36,.12)] text-left text-[#fde68a]")} role="status">
            <span className="flex-1">{assistantScreen.noisyHint}</span>
            <button type="button" onClick={call.acceptNoiseHint} className="min-h-8.5 flex-none cursor-pointer rounded-full bg-[#fbbf24] px-3.5 text-[13px] font-semibold text-[#1c1917]">
              {assistantScreen.noisyEnable}
            </button>
            <button
              type="button"
              onClick={call.dismissNoiseHint}
              aria-label={assistantScreen.noisyDismiss}
              className="grid min-h-8.5 w-8.5 flex-none cursor-pointer place-items-center text-[#fde68a] [&_svg]:size-4"
            >
              <X aria-hidden="true" />
            </button>
          </div>
        )}

        {call.notice && (
          <p className={cn(notice, "border-[rgba(251,191,36,.4)] bg-[rgba(251,191,36,.12)] text-[#fde68a]")} role="status">
            {call.notice}
          </p>
        )}

        {call.error && (
          <p className={cn(notice, "border-[rgba(251,113,133,.4)] bg-[rgba(225,29,72,.12)] text-[#fecdd3]")} role="alert">
            {call.error}
          </p>
        )}
      </div>

      <ChatHistory lines={call.lines} handoff={call.handoff} open={historyOpen} docked={dock} onClose={() => setHistoryOpen(false)} />
    </div>
  );
}
