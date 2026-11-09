"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  openVoiceLine,
  type Meter,
  type PlaybackState,
  type VoiceLine,
} from "@/lib/voice/audio";
import {
  parseServerMessage,
  voiceSocketUrl,
  type CallPhase,
  type ServerMessage,
  type StepInfo,
} from "@/lib/voice/protocol";

export type CallStatus = "idle" | "connecting" | "live" | "ended" | "error";
export type Mode = "idle" | "listening" | "thinking" | "speaking";
export type Line = { key: string; speaker: "user" | "assistant"; text: string };

/** Everything imperative about one call. Lives in a ref: none of it is rendered. */
type Runtime = {
  ws: WebSocket;
  context: AudioContext;
  line: VoiceLine;
  ready: boolean;
  closedByUs: boolean;
  micOn: boolean;
  /** The guide step on screen (mirrors the `step` state, for handlers that must not read state). */
  step: StepInfo | null;
};

// Levels are read by animation frames straight from the audio graph, never through React state. One call at a time.
const active: { user: Meter | null; assistant: Meter | null } = {
  user: null,
  assistant: null,
};
const reader = (pick: () => Meter | null) => ({
  level: () => pick()?.level() ?? 0,
  bands: (count: number) =>
    pick()?.bands(count) ?? new Array<number>(count).fill(0),
});
const meters = {
  user: reader(() => active.user),
  assistant: reader(() => active.assistant),
};

const stepOf = (
  message: Extract<ServerMessage, { type: "step" }>,
): StepInfo => ({
  guideId: message.guideId,
  file: message.file,
  stepIndex: message.stepIndex,
  title: message.title,
  method: message.method,
  stepTitle: message.stepTitle,
  totalSteps: message.totalSteps,
});

function friendly(error: unknown): string {
  if (
    error instanceof DOMException &&
    (error.name === "NotAllowedError" || error.name === "SecurityError")
  ) {
    return "Bạn cần cho phép dùng micro để nói chuyện với trợ lý.";
  }
  if (error instanceof DOMException && error.name === "NotFoundError")
    return "Không tìm thấy micro trên thiết bị.";
  return "Không mở được cuộc gọi. Nếu khẩn cấp, hãy gọi 115 ngay.";
}

/**
 * One voice call with the first-aid assistant: microphone -> WebSocket -> realtime model -> assistant voice.
 * `frameRef` is the iframe of the 3D guide the assistant opens (it narrates itself and reports its own steps).
 */
export function useVoiceCall(frameRef: RefObject<HTMLIFrameElement | null>) {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("idle");
  const [phase, setPhase] = useState<CallPhase | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [step, setStep] = useState<StepInfo | null>(null);
  const [handoff, setHandoff] = useState("");
  const [micOn, setMicOn] = useState(true);
  const runtime = useRef<Runtime | null>(null);

  const postStep = useCallback(
    (index: number) =>
      frameRef.current?.contentWindow?.postMessage(
        { type: "sosnow-live-guide-step", stepIndex: index },
        "*",
      ),
    [frameRef],
  );

  /** Put a step on screen and, unless the 3D guide itself chose it, move the guide there. */
  const show = useCallback(
    (rt: Runtime, info: StepInfo, push = true) => {
      rt.step = info;
      setStep(info);
      if (push) postStep(info.stepIndex);
    },
    [postStep],
  );

  /** The guide's page finished loading: bring it to the step on screen (a new guide opens at its first step). */
  const onFrameLoad = useCallback(() => {
    const step = runtime.current?.step;
    if (step) postStep(step.stepIndex);
  }, [postStep]);

  const teardown = useCallback((rt: Runtime) => {
    rt.closedByUs = true;
    rt.line.stop();
    active.user = active.assistant = null;
    try {
      rt.ws.close();
    } catch {
      // already closed
    }
    void rt.context.close().catch(() => {});
    if (runtime.current === rt) runtime.current = null;
  }, []);

  const handle = useCallback(
    (rt: Runtime, message: ServerMessage) => {
      switch (message.type) {
        case "answer":
          void rt.line.accept(message.sdp).catch(() => {
            setStatus("error");
            setError(
              "Không mở được kênh âm thanh. Nếu khẩn cấp, hãy gọi 115 ngay.",
            );
          });
          break;
        case "ready":
          rt.ready = true;
          setStatus("live");
          setMode("listening");
          break;
        case "transcript": {
          const text = message.text.trim();
          if (!text) break;
          const key = `${message.speaker}:${message.index}`;
          setLines((current) => {
            const at = current.findIndex((line) => line.key === key);
            if (at < 0)
              return [...current, { key, speaker: message.speaker, text }];
            const next = [...current];
            next[at] = { ...next[at], text };
            return next;
          });
          break;
        }
        case "phase":
          setPhase(message.phase);
          break;
        case "handoff":
          setHandoff(message.summary);
          break;
        case "step":
          show(rt, stepOf(message));
          break;
        case "turn_complete":
          setMode((current) =>
            current === "thinking" ? "listening" : current,
          );
          break;
        case "error":
          setError(message.message);
          break;
        case "ended":
          rt.closedByUs = true;
          setStatus("ended");
          setMode("idle");
          break;
      }
    },
    [show],
  );

  const start = useCallback(async () => {
    if (runtime.current) return;
    setStatus("connecting");
    setError(null);
    setMode("idle");
    setPhase(null);
    setLines([]);
    setStep(null);
    setHandoff("");
    setMicOn(true);

    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      context = new AudioContext({ latencyHint: "interactive" });
      await context.resume();
      const ws = new WebSocket(voiceSocketUrl());
      const line = openVoiceLine(context, stream, (state: PlaybackState) =>
        onPlayback(rt, state),
      );

      const rt: Runtime = {
        ws,
        context,
        line,
        ready: false,
        closedByUs: false,
        micOn: true,
        step: null,
      };
      runtime.current = rt;
      active.assistant = line.voice;
      active.user = line.mic;

      function onPlayback(_current: Runtime, state: PlaybackState) {
        if (state === "playing") setMode("speaking");
        else setMode((now) => (now === "speaking" ? "listening" : now));
      }

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "start", consent: true }));
        void line
          .offer()
          .then((sdp) => ws.send(JSON.stringify({ type: "offer", sdp })))
          .catch(() => ws.close());
      };
      ws.onmessage = (event: MessageEvent<string>) => {
        const message = parseServerMessage(event.data);
        if (message) handle(rt, message);
      };
      ws.onclose = () => {
        if (rt.closedByUs) return;
        const wasLive = rt.ready;
        teardown(rt);
        setMode("idle");
        if (wasLive) {
          setStatus("ended");
        } else {
          setStatus("error");
          setError(
            "Chưa kết nối được trợ lý (đang bận hoặc chưa sẵn sàng). Nếu khẩn cấp, hãy gọi 115 ngay.",
          );
        }
      };
    } catch (cause) {
      stream?.getTracks().forEach((track) => track.stop());
      void context?.close().catch(() => {});
      const rt = runtime.current;
      if (rt) teardown(rt);
      setStatus("error");
      setError(friendly(cause));
    }
  }, [handle, teardown]);

  const end = useCallback(() => {
    const rt = runtime.current;
    if (!rt) return;
    if (rt.ws.readyState === WebSocket.OPEN)
      rt.ws.send(JSON.stringify({ type: "stop" }));
    teardown(rt);
    setStatus("ended");
    setMode("idle");
  }, [teardown]);

  const toggleMic = useCallback(() => {
    const rt = runtime.current;
    if (!rt) return;
    rt.micOn = !rt.micOn;
    rt.line.setMuted(!rt.micOn);
    setMicOn(rt.micOn);
  }, []);

  /** The caller picked a step by hand (progress bar): move the guide and tell the assistant. */
  const selectStep = useCallback(
    (index: number, push = true) => {
      const rt = runtime.current;
      const current = rt?.step;
      if (
        !rt ||
        !current ||
        index < 0 ||
        index >= current.totalSteps ||
        index === current.stepIndex
      )
        return;
      if (rt.ws.readyState === WebSocket.OPEN) {
        rt.ws.send(
          JSON.stringify({
            type: "ui_step",
            guideId: current.guideId,
            stepIndex: index,
          }),
        );
      }
      show(rt, { ...current, stepIndex: index, stepTitle: "" }, push);
    },
    [show],
  );

  // The 3D guide reports when its own step buttons are used. It is a silent visual here: the assistant is the only
  // voice, so the microphone stays open and the caller can cut in at any time.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const rt = runtime.current;
      if (!rt || event.source !== frameRef.current?.contentWindow) return;
      const data: unknown = event.data;
      if (!data || typeof data !== "object") return;
      const { type, stepIndex } = data as {
        type?: unknown;
        stepIndex?: unknown;
      };
      if (
        type === "sosnow-live-guide-step-change" &&
        typeof stepIndex === "number"
      )
        selectStep(stepIndex, false);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [frameRef, selectStep]);

  useEffect(
    () => () => {
      const rt = runtime.current;
      if (rt) teardown(rt);
    },
    [teardown],
  );

  return {
    status,
    error,
    mode,
    phase,
    lines,
    step,
    handoff,
    micOn,
    meters,
    start,
    end,
    toggleMic,
    selectStep,
    onFrameLoad,
  };
}
