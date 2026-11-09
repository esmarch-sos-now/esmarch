"use client";

import { useEffect, useRef } from "react";

export type Tone = "assistant" | "user" | "idle";

/** Frequency bars of whoever is talking. `mirror` flips the order so two of them sit symmetrically around the orb. */
export default function VoiceVisualizer({
  bands,
  tone,
  count = 7,
  mirror = false,
}: {
  bands: (count: number) => number[];
  tone: Tone;
  count?: number;
  mirror?: boolean;
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
    <div className={`fa-bars fa-bars-${tone}`} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          ref={(node) => {
            bars.current[i] = node;
          }}
        />
      ))}
    </div>
  );
}
