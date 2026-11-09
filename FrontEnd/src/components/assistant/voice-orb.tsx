"use client";

import { useEffect, useRef } from "react";
import type { Mode } from "@/hooks/useVoiceCall";

type Rgb = [number, number, number];

// Same states and colours as the demo's orb: idle grey, listening cyan, thinking violet, speaking red.
const MODE_COLORS: Record<Mode, [Rgb, Rgb]> = {
  idle: [[195, 202, 214], [74, 83, 102]],
  listening: [[94, 231, 255], [20, 99, 255]],
  thinking: [[216, 180, 254], [109, 40, 217]],
  speaking: [[255, 138, 155], [200, 16, 46]],
};

const POINTS = 96;
const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount;
const css = ([r, g, b]: Rgb, alpha = 1) => `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${alpha})`;

/** The voice orb: a blob that wobbles with the loudness of whoever is talking and changes colour with the state. */
export default function VoiceOrb({ mode, level }: { mode: Mode; level: () => number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const modeRef = useRef(mode);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext("2d");
    if (!element || !context) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const colors: [Rgb, Rgb] = [[...MODE_COLORS.idle[0]], [...MODE_COLORS.idle[1]]];
    let volume = 0;
    let size = 0;
    let frame = 0;

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      size = Math.max(1, element.clientWidth);
      element.width = element.height = Math.round(size * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);

    const draw = (now: number) => {
      const time = now / 1000;
      const target = MODE_COLORS[modeRef.current];
      for (let i = 0; i < 2; i++) for (let c = 0; c < 3; c++) colors[i][c] = lerp(colors[i][c], target[i][c], 0.08);
      volume = lerp(volume, Math.min(1, level() * 2.5), 0.25);

      const centre = size / 2;
      const radius = size * 0.34;
      const amplitude = (0.04 + volume * 0.3) * (calm ? 0.3 : 1);
      context.clearRect(0, 0, size, size);
      context.beginPath();
      for (let i = 0; i <= POINTS; i++) {
        const angle = (i / POINTS) * Math.PI * 2;
        const wave =
          Math.sin(angle * 3 + time * 1.7) * Math.sin(angle * 2 - time * 1.3) * Math.sin(angle * 4 + time * 2.1);
        const r = radius * (1 + wave * amplitude * 2.2);
        const x = centre + Math.cos(angle) * r;
        const y = centre + Math.sin(angle) * r;
        if (i === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.closePath();
      const fill = context.createRadialGradient(centre - radius * 0.3, centre - radius * 0.3, radius * 0.1, centre, centre, radius * 1.3);
      fill.addColorStop(0, css(colors[0], 0.95));
      fill.addColorStop(1, css(colors[1], 0.9));
      context.shadowColor = css(colors[0], 0.5);
      context.shadowBlur = size * (0.08 + volume * 0.12);
      context.fillStyle = fill;
      context.fill();
      context.shadowBlur = 0;
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [level]);

  return <canvas ref={canvas} className="fa-orb" aria-hidden="true" />;
}
