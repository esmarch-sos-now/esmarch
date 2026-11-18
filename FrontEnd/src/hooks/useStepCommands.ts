"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { isMicDenied, speechCtor, stepCommand, type BrowserSpeech, type StepCommand } from "@/lib/voice/speech";

export type CommandStatus = "unsupported" | "off" | "denied" | "reading" | "listening";

/** A command just carried out, shown briefly so the caller knows it was heard. */
export type HeardCommand = { command: StepCommand; at: number };

// A command fires on the first (interim) result that holds it; the rest of the same phrase must not fire it again
const COOLDOWN_MS = 1500;
// Chrome ends a recognition after some silence; it is started again after this pause (also bounds an error loop)
const RESTART_MS = 250;
// What is heard while the guide reads aloud, and this long after, may be the narration from the speaker: ignored
const AFTER_NARRATION_MS = 400;

const noSubscribe = () => () => {};

/**
 * Voice commands for the step-by-step 3D guide in `frame`: "xong"/"tiếp", "nhắc lại", "quay lại", "gọi 115".
 * Everything runs in the browser (no AI, no server), so a step changes as soon as the word is recognised.
 *
 * Recognition keeps running while the guide narrates (a microphone takes 1-2 s to start again, a Bluetooth headset
 * even longer, and a "xong" said in that gap was lost), but what it hears then is ignored, so the narration coming
 * out of the speaker is not taken for a command. A microphone stream is held open for the same reason: Chrome ends
 * a recognition after a few seconds of silence, and the next one starts at once only if the device is already on. The guide page reports narration (`sosnow-live-guide-narration`) and every step it shows
 * (`sosnow-guide-step-shown`); commands go back as `sosnow-live-guide-step`, the message the page already obeys.
 */
export function useStepCommands(frame: RefObject<HTMLIFrameElement | null>) {
  const supported = useSyncExternalStore(noSubscribe, () => speechCtor() !== null, () => false);
  const [enabled, setEnabled] = useState(true);
  const [denied, setDenied] = useState(false);
  const [narrating, setNarrating] = useState(false);
  const [heard, setHeard] = useState<HeardCommand | null>(null);
  const step = useRef(0);
  const ignoreUntil = useRef(0);

  // What the guide page says: the step on screen, and whether it is reading aloud
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!frame.current || event.source !== frame.current.contentWindow) return;
      const data = event.data as { type?: unknown; stepIndex?: unknown; active?: unknown } | null;
      if (data?.type === "sosnow-guide-step-shown" && Number.isInteger(data.stepIndex)) step.current = data.stepIndex as number;
      if (data?.type === "sosnow-live-guide-narration") {
        const active = data.active === true;
        ignoreUntil.current = active ? Number.POSITIVE_INFINITY : Date.now() + AFTER_NARRATION_MS;
        setNarrating(active);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [frame]);

  const listening = supported && enabled && !denied;

  useEffect(() => {
    if (!listening) return;
    const Ctor = speechCtor();
    if (!Ctor) return;
    let live = true;
    let lastFired = 0;
    let restart: ReturnType<typeof setTimeout> | undefined;
    let recognition: BrowserSpeech | null = null;
    let warm: MediaStream | null = null;
    navigator.mediaDevices
      ?.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      .then((stream) => {
        if (live) warm = stream;
        else stream.getTracks().forEach((track) => track.stop());
      })
      .catch(() => {}); // recognition reports a refused microphone itself

    const show = (index: number) => {
      frame.current?.contentWindow?.postMessage({ type: "sosnow-live-guide-step", stepIndex: Math.max(0, index) }, "*");
    };
    const run = (command: StepCommand) => {
      if (command === "call115") window.location.href = "tel:115";
      else show(step.current + (command === "next" ? 1 : command === "previous" ? -1 : 0)); // the page clamps the last step
      setHeard({ command, at: Date.now() });
    };

    const begin = () => {
      const r = new Ctor();
      r.lang = "vi-VN";
      r.continuous = true;
      r.interimResults = true; // act on the first words heard, not after the phrase ends
      r.onresult = (event) => {
        if (Date.now() < ignoreUntil.current) return;
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const command = stepCommand(event.results[i][0].transcript);
          if (!command) continue;
          const now = Date.now();
          if (now - lastFired < COOLDOWN_MS) return;
          lastFired = now;
          run(command);
          return;
        }
      };
      r.onerror = (event) => {
        if (isMicDenied(event.error)) {
          live = false;
          setDenied(true);
        }
      };
      r.onend = () => {
        if (live) restart = setTimeout(begin, RESTART_MS);
      };
      recognition = r;
      try {
        r.start();
      } catch {
        restart = setTimeout(begin, RESTART_MS);
      }
    };

    begin();
    return () => {
      live = false;
      clearTimeout(restart);
      recognition?.abort();
      warm?.getTracks().forEach((track) => track.stop());
    };
  }, [listening, frame]);

  const status: CommandStatus = !supported
    ? "unsupported"
    : !enabled
      ? "off"
      : denied
        ? "denied"
        : narrating
          ? "reading"
          : "listening";

  const toggle = () => {
    setDenied(false); // turning it on again asks for the microphone again
    setEnabled((on) => !on);
  };
  return { status, heard, toggle };
}
