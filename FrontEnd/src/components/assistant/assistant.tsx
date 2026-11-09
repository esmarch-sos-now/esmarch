"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import Link from "next/link";
import { ArrowLeft, History, MicOff, Phone, PhoneOff, X } from "lucide-react";
import { useVoiceCall, type Mode } from "@/hooks/useVoiceCall";
import { PHASE_LABEL } from "@/lib/voice/protocol";
import { assistantScreen } from "@/content/app";
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

  return (
    <div className="fa" data-layout={step ? "dock" : "hero"} data-noisy={call.noisy || undefined}>
      <header className="fa-top">
        <Link className="fa-back" href="/app/sos">
          <ArrowLeft aria-hidden="true" /> <span>Thoát</span>
        </Link>
        <a className="fa-115" href="tel:115" data-urgent={call.urgent || undefined}>
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
            className="fa-stage"
            src={`/guides/${step.file}`}
            title={step.title}
            sandbox="allow-scripts"
            allow="autoplay; fullscreen"
            onLoad={call.onFrameLoad}
          />
        </>
      ) : (
        <div className="fa-glow" aria-hidden="true" />
      )}

      <div className="fa-console">
        <div className="fa-caption" aria-live="polite">
          {caption ? (
            <p>{caption}</p>
          ) : (
            !live && (
              <>
                <h1>{assistantScreen.title}</h1>
                <p className="fa-lede">{assistantScreen.lede}</p>
              </>
            )
          )}
          {live && lastUser && <p className="fa-user-line">Bạn: {lastUser}</p>}
        </div>

        <div className="fa-orbrow">
          <button type="button" className="fa-icon fa-hide-idle" data-hidden={!live && call.lines.length === 0} onClick={() => setHistoryOpen((open) => !open)} aria-label="Lịch sử trò chuyện" aria-pressed={historyOpen}>
            <History aria-hidden="true" />
          </button>
          <div className="fa-viz"><VoiceVisualizer bands={bands} tone={tone} mirror /></div>
          <button
            type="button"
            className="fa-orbbtn"
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
            {live && !hold && !call.micOn && <MicOff className="fa-micoff" aria-hidden="true" />}
          </button>
          <div className="fa-viz"><VoiceVisualizer bands={bands} tone={tone} /></div>
          <span className="fa-spacer" aria-hidden="true" />
        </div>

        {live ? (
          <div className="fa-status">
            <span className="fa-status-text">
              {statusText}
              {call.phase && ` · ${PHASE_LABEL[call.phase]}`}
            </span>
            <button type="button" className="fa-end" onClick={call.end} aria-label="Kết thúc cuộc gọi">
              <PhoneOff aria-hidden="true" /> <span className="fa-end-label">Kết thúc</span>
            </button>
          </div>
        ) : (
          <div className="fa-start">
            <button type="button" className="fa-startbtn" onClick={onOrb} disabled={connecting}>
              <Phone aria-hidden="true" />
              {connecting ? "Đang kết nối…" : status === "idle" ? assistantScreen.start : assistantScreen.again}
            </button>
            <p className="fa-consent">{assistantScreen.consent}</p>
          </div>
        )}

        {live && (
          <div className="fa-talk" role="group" aria-label={assistantScreen.talkModeLabel}>
            <button type="button" aria-pressed={!hold} onClick={() => call.setTalkMode("open")}>
              {assistantScreen.talkFree}
            </button>
            <button type="button" aria-pressed={hold} onClick={() => call.setTalkMode("hold")}>
              {assistantScreen.talkHold}
            </button>
          </div>
        )}

        {live && call.noiseHint && (
          <div className="fa-notice fa-hint" role="status">
            <span>{assistantScreen.noisyHint}</span>
            <button type="button" onClick={call.acceptNoiseHint}>{assistantScreen.noisyEnable}</button>
            <button type="button" className="fa-hint-x" onClick={call.dismissNoiseHint} aria-label={assistantScreen.noisyDismiss}>
              <X aria-hidden="true" />
            </button>
          </div>
        )}

        {call.notice && (
          <p className="fa-notice" role="status">
            {call.notice}
          </p>
        )}

        {call.error && (
          <p className="fa-error" role="alert">
            {call.error}
          </p>
        )}
      </div>

      <ChatHistory lines={call.lines} handoff={call.handoff} open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </div>
  );
}
