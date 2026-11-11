"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export type Tone = "assistant" | "user" | "idle";

const TONE: Record<Tone, string> = {
  assistant: "bg-[#fb7185]",
  user: "bg-[#67e8f9]",
  idle: "bg-white/15",
};

/** Frequency bars of whoever is talking. `mirror` flips the order so two of them sit symmetrically around the orb. */
export default function VoiceVisualizer({
  bands,
  tone,
  count = 7,
  mirror = false,
  className,
}: {
  bands: (count: number) => number[];
  tone: Tone;
  count?: number;
  mirror?: boolean;
  className?: string;
}) {
  const bars = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const levels = tone === "idle" ? new Array<number>(count).fill(0) : bands(count);
      const ordered = mirror ? [...levels].reverse() : levels;
      ordered.forEach((level, i) => {
        const bar = bars.current[i];
        if (bar) bar.style.height = `${Math.max(12, Math.min(100, level * 260))}%`;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [bands, tone, count, mirror]);

  return (
    <div className={cn("flex h-12 items-center gap-1", className)} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          ref={(node) => {
            bars.current[i] = node;
          }}
          className={cn("h-[12%] w-1.5 rounded-md transition-[height,background-color] duration-100 ease-out motion-reduce:transition-none", TONE[tone])}
        />
      ))}
    </div>
  );
}
