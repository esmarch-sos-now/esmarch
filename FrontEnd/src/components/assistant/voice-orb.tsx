"use client";

import { useEffect, useRef } from "react";
import { Orb, type OrbLook } from "@yogesharc/thinking-orbs";
import type { Mode } from "@/hooks/useVoiceCall";
import { cn } from "@/lib/utils";

// Which Thinking Orbs look stands for each call mode.
const LOOKS: Record<Mode, OrbLook> = {
  idle: { state: "idle", variant: "blink" },
  listening: { state: "using", variant: "record" },
  thinking: { state: "reasoning" },
  speaking: { state: "working" },
};

// Orb colour per mode (the dots and glow use currentColor).
const COLOR: Record<Mode, string> = {
  idle: "text-[#c3cad6]",
  listening: "text-[#5ee7ff]",
  thinking: "text-[#d8b4fe]",
  speaking: "text-[#ff8a9b]",
};

// Drawn at one fixed size (dot count grows with it) and scaled to fit the button.
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
    <span
      ref={wrap}
      data-mode={mode}
      aria-hidden="true"
      className={cn(
        "pointer-events-none block size-full scale-[calc(1+var(--fa-level,0)*0.18)] drop-shadow-[0_0_calc(6px+var(--fa-level,0)*14px)_currentColor] transition-colors duration-400 [&_svg]:block [&_svg]:size-full",
        COLOR[mode],
      )}
    >
      <Orb {...LOOKS[mode]} size={SIZE} />
    </span>
  );
}
