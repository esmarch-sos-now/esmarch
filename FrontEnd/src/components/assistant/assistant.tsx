"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, History, MicOff, Phone, PhoneOff } from "lucide-react";
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
  const call = useVoiceCall(frame);
  const [historyOpen, setHistoryOpen] = useState(false);

  const { status, mode, step, meters } = call;

  // On a wide screen the transcript opens beside the guide when the call connects (the dock itself has no text).
  useEffect(() => {
    if (status === "live" && window.matchMedia("(min-width: 900px)").matches) setHistoryOpen(true);
  }, [status]);
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

  const onOrb = () => {
    if (live) call.toggleMic();
    else if (!connecting) void call.start();
  };

  return (
    <div className="fa" data-layout={step ? "dock" : "hero"}>
      <header className="fa-top">
        <Link className="fa-back" href="/app/sos">
          <ArrowLeft aria-hidden="true" /> <span>Thoát</span>
        </Link>
        <a className="fa-115" href="tel:115">
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
            aria-label={live ? (call.micOn ? "Tắt micro" : "Bật micro") : "Gọi trợ lý sơ cứu"}
          >
            <VoiceOrb mode={live ? mode : "idle"} level={level} />
            {live && !call.micOn && <MicOff className="fa-micoff" aria-hidden="true" />}
          </button>
          <div className="fa-viz"><VoiceVisualizer bands={bands} tone={tone} /></div>
          <span className="fa-spacer" aria-hidden="true" />
        </div>

        {live ? (
          <div className="fa-status">
            <span className="fa-status-text">
              {call.micOn ? MODE_LABEL[mode] : "Micro đang tắt"}
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
