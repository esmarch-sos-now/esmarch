"use client";

import { useEffect, useRef } from "react";
import { Orb, type OrbLook } from "@yogesharc/thinking-orbs";
import type { Mode } from "@/hooks/useVoiceCall";

// Which Thinking Orbs look stands for each call mode. Colour is set per mode in assistant.css via data-mode.
const LOOKS: Record<Mode, OrbLook> = {
  idle: { state: "idle", variant: "blink" },
  listening: { state: "using", variant: "record" },
  thinking: { state: "reasoning" },
  speaking: { state: "working" },
};

// Drawn at one fixed size (dot count grows with it) and scaled by CSS to fit the button.
const SIZE = 64;
const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount;

/** The voice orb: a Thinking Orb whose look and colour follow the call mode and that swells with the loudness of whoever is talking. */
export default function VoiceOrb({ mode, level }: { mode: Mode; level: () => number }) {
  const wrap = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const element = wrap.current;
    if (!element) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let volume = 0;
    let frame = 0;
    const tick = () => {
      volume = lerp(volume, Math.min(1, level() * 2.5), 0.25);
      element.style.setProperty("--fa-level", (volume * (calm ? 0.3 : 1)).toFixed(3));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [level]);

  return (
    <span ref={wrap} className="fa-orb" data-mode={mode} aria-hidden="true">
      <Orb {...LOOKS[mode]} size={SIZE} />
    </span>
  );
}
