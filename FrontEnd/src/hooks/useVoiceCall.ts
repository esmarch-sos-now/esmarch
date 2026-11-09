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
  type LineConnection,
  type Meter,
  type PlaybackState,
  type VoiceLine,
} from "@/lib/voice/audio";
import { assistantScreen } from "@/content/app";
import {
  CLOSE_UNKNOWN_CALL,
  parseServerMessage,
  voiceSocketUrl,
  type CallPhase,
  type ServerMessage,
  type StepInfo,
} from "@/lib/voice/protocol";

export type CallStatus = "idle" | "connecting" | "live" | "ended" | "error";
export type Mode = "idle" | "listening" | "thinking" | "speaking";
export type Line = { key: string; speaker: "user" | "assistant"; text: string };

/** The backend keeps a dropped call for 20 s; stop retrying a little before that. */
const RESUME_WINDOW_MS = 18_000;
const RESUME_DELAYS_MS = [500, 1000, 2000, 4000];
/** A WebRTC `disconnected` often heals by itself; past this it is treated as lost. */
const ICE_GRACE_MS = 8000;
const NOTICE_MS = 20_000;
/** Hold-to-talk keeps the microphone open a moment after release so the last syllable is not cut. */
const HOLD_TAIL_MS = 300;

// Noisy-place heuristic: a heuristic to be tuned on real devices, not a measurement. Normal speech has gaps, so a
// level that stays high for most of a window means a crowd or machinery, not one person talking. The level is read
// after the browser's own noise suppression, so only noise that got through counts.
const NOISE_SAMPLE_MS = 250;
const NOISE_WINDOW_MS = 8000;
const NOISE_LEVEL = 0.2;
const NOISE_LOUD_RATIO = 0.85;
const NOISE_SAMPLES = NOISE_WINDOW_MS / NOISE_SAMPLE_MS;

/** AGC helps a phone lying far from the caller but also lifts background voices: switch it off at build time to A/B test. */
const AGC = !["0", "false"].includes(
  (process.env.NEXT_PUBLIC_VOICE_AGC ?? "").trim().toLowerCase(),
);

/** `voiceIsolation` is missing from TypeScript's DOM types and from many browsers. */
type IsolationConstraints = MediaTrackConstraints & {
  voiceIsolation?: ConstrainBoolean;
};
type IsolationSupport = MediaTrackSupportedConstraints & {
  voiceIsolation?: boolean;
};

export type TalkMode = "open" | "hold";

/** Everything imperative about one call. Lives in a ref: none of it is rendered. */
type Runtime = {
  /** Replaced on every resume; null between a drop and the next attempt. */
  ws: WebSocket | null;
  /** Credential for resuming the call: kept here only, never rendered or logged. */
  callId: string | null;
  context: AudioContext;
  line: VoiceLine;
  ready: boolean;
  /** The call is over and released (by us, the server or a failure): every handler must ignore events from now on. */
  closedByUs: boolean;
  socketDown: boolean;
  iceDown: boolean;
  attempt: number;
  timers: {
    retry?: ReturnType<typeof setTimeout>;
    giveUp?: ReturnType<typeof setTimeout>;
    ice?: ReturnType<typeof setTimeout>;
    notice?: ReturnType<typeof setTimeout>;
    /** Pending mute after a hold-to-talk release. */
    release?: ReturnType<typeof setTimeout>;
    /** Interval sampling the mic level for the noisy-place hint (cleared with clearTimeout like the rest). */
    noise?: ReturnType<typeof setInterval>;
  };
  /** What the server actually hears (mirrors the `micOn` state); always derived by `applyMic`. */
  micOn: boolean;
  talkMode: TalkMode;
  /** Open mode: the caller's own choice (mute button). */
  openMic: boolean;
  /** Hold mode: the button is down, or was released less than HOLD_TAIL_MS ago. */
  holding: boolean;
  /** The assistant is audible: its voice through the loudspeaker must not count as noise. */
  playing: boolean;
  /** Recent mic-level samples, true = loud. */
  loud: boolean[];
  /** The noisy hint was shown and answered (or the call is in hold mode): do not suggest again in this call. */
  hintDone: boolean;
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

type Outcome = {
  status: "ended" | "error";
  error?: string;
  notice?: string;
  /** Tell the server we are leaving (only possible while the socket is open). */
  stop?: boolean;
};

/** What the user is told for each reason the server gives when it ends the call. */
function outcomeOf(reason: string): Outcome {
  if (reason === "completed" || reason === "stopped")
    return { status: "ended" };
  if (reason === "time_limit")
    return { status: "ended", notice: assistantScreen.timeLimit };
  // error, session_ended, no_offer, disconnected and anything unknown: never look like a normal end.
  return { status: "error", error: assistantScreen.problem };
}

/**
 * One voice call with the first-aid assistant: microphone -> WebSocket -> realtime model -> assistant voice.
 * `frameRef` is the iframe of the 3D guide the assistant opens (it narrates itself and reports its own steps).
 * `onLive` runs once each time the call goes live (the server's `ready`), for UI that should react to that moment.
 */
export function useVoiceCall(
  frameRef: RefObject<HTMLIFrameElement | null>,
  onLive?: () => void,
) {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("idle");
  const [phase, setPhase] = useState<CallPhase | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [step, setStep] = useState<StepInfo | null>(null);
  const [handoff, setHandoff] = useState("");
  const [micOn, setMicOn] = useState(true);
  const [reconnecting, setReconnecting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [urgent, setUrgent] = useState(false);
  const [talkMode, setTalkModeState] = useState<TalkMode>("open");
  const [noisy, setNoisy] = useState(false);
  const [noiseHint, setNoiseHint] = useState(false);
  const runtime = useRef<Runtime | null>(null);
  const starting = useRef(false);
  const mounted = useRef(false);
  const onLiveRef = useRef(onLive);
  useEffect(() => {
    onLiveRef.current = onLive;
  });

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

  /** Release everything of a call, exactly once (later calls are no-ops). */
  const teardown = useCallback((rt: Runtime) => {
    if (rt.closedByUs) return;
    rt.closedByUs = true;
    for (const timer of Object.values(rt.timers)) clearTimeout(timer);
    rt.timers = {};
    rt.line.stop();
    active.user = active.assistant = null;
    const ws = rt.ws;
    rt.ws = null;
    if (ws) {
      // Detach first: the close we cause must not look like a drop.
      ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
      try {
        ws.close();
      } catch {
        // already closed
      }
    }
    void rt.context.close().catch(() => {});
    if (runtime.current === rt) runtime.current = null;
  }, []);

  /** The one way a call ends: release it, then show how it ended. */
  const finish = useCallback(
    (rt: Runtime, outcome: Outcome) => {
      if (rt.closedByUs) return;
      if (outcome.stop && rt.ws?.readyState === WebSocket.OPEN)
        rt.ws.send(JSON.stringify({ type: "stop" }));
      teardown(rt);
      setStatus(outcome.status);
      setError(outcome.error ?? null);
      setNotice(outcome.notice ?? null);
      setMode("idle");
      setReconnecting(false);
    },
    [teardown],
  );

  /** The one place that decides what the server hears; the `micOn` state always shows exactly that. */
  const applyMic = useCallback((rt: Runtime) => {
    const heard = rt.talkMode === "open" ? rt.openMic : rt.holding;
    rt.micOn = heard;
    rt.line.setMuted(!heard);
    setMicOn(heard);
  }, []);

  const syncReconnecting = (rt: Runtime) =>
    setReconnecting(rt.socketDown || rt.iceDown);

  const handle = useCallback(
    (rt: Runtime, message: ServerMessage) => {
      switch (message.type) {
        case "answer":
          if (typeof message.callId === "string") rt.callId = message.callId;
          void rt.line.accept(message.sdp).catch(() =>
            finish(rt, {
              status: "error",
              error:
                "Không mở được kênh âm thanh. Nếu khẩn cấp, hãy gọi 115 ngay.",
              stop: true,
            }),
          );
          break;
        case "ready":
          rt.ready = true;
          setStatus("live");
          setMode("listening");
          onLiveRef.current?.();
          break;
        case "resumed":
          clearTimeout(rt.timers.retry);
          clearTimeout(rt.timers.giveUp);
          rt.timers.retry = rt.timers.giveUp = undefined;
          rt.attempt = 0;
          rt.socketDown = false;
          syncReconnecting(rt);
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
        case "signs":
          setUrgent(message.awake === false || message.breathing === false);
          break;
        case "ending_soon": {
          const seconds = Number(message.seconds);
          const left =
            seconds >= 90
              ? `${Math.round(seconds / 60)} phút`
              : `${Math.max(1, Math.round(seconds || 60))} giây`;
          setNotice(`${assistantScreen.endingSoon} (còn khoảng ${left})`);
          clearTimeout(rt.timers.notice);
          rt.timers.notice = setTimeout(() => setNotice(null), NOTICE_MS);
          break;
        }
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
          // The server is done and about to close: release everything here, so a new call can start.
          finish(rt, outcomeOf(message.reason));
          break;
      }
    },
    [show, finish],
  );

  /** Open the signaling socket: a fresh `start`, or a `resume` of a live call after a drop. */
  const attach = useCallback(
    (rt: Runtime, firstResume: boolean) => {
      open(firstResume);

      function open(resume: boolean) {
        const ws = new WebSocket(voiceSocketUrl());
        rt.ws = ws;

        const lose = () => {
          if (rt.closedByUs) return;
          finish(rt, {
            status: "error",
            error: assistantScreen.connectionLost,
            stop: true,
          });
        };

        const retry = () => {
          const delay =
            RESUME_DELAYS_MS[Math.min(rt.attempt, RESUME_DELAYS_MS.length - 1)];
          rt.attempt += 1;
          rt.timers.retry = setTimeout(() => {
            rt.timers.retry = undefined;
            if (!rt.closedByUs) open(true);
          }, delay);
        };

        ws.onopen = () => {
          if (resume) {
            ws.send(JSON.stringify({ type: "resume", callId: rt.callId }));
            return;
          }
          ws.send(JSON.stringify({ type: "start", consent: true }));
          void rt.line
            .offer()
            .then((sdp) => ws.send(JSON.stringify({ type: "offer", sdp })))
            .catch(() => ws.close());
        };
        ws.onmessage = (event: MessageEvent<string>) => {
          if (rt.ws !== ws) return;
          const message = parseServerMessage(event.data);
          if (message) handle(rt, message);
        };
        ws.onclose = (event: CloseEvent) => {
          if (rt.closedByUs || rt.ws !== ws) return;
          rt.ws = null;
          if (!rt.ready || !rt.callId) {
            finish(rt, {
              status: "error",
              error:
                "Chưa kết nối được trợ lý (đang bận hoặc chưa sẵn sàng). Nếu khẩn cấp, hãy gọi 115 ngay.",
            });
            return;
          }
          // The audio is a separate WebRTC link and may be fine: keep it and take the call back on a new socket.
          if (event.code === CLOSE_UNKNOWN_CALL) {
            lose();
            return;
          }
          if (!rt.socketDown) {
            rt.socketDown = true;
            syncReconnecting(rt);
            rt.timers.giveUp = setTimeout(lose, RESUME_WINDOW_MS);
          }
          retry();
        };
      }
    },
    [handle, finish],
  );

  const start = useCallback(async () => {
    if (runtime.current || starting.current) return;
    starting.current = true;
    setStatus("connecting");
    setError(null);
    setNotice(null);
    setMode("idle");
    setPhase(null);
    setLines([]);
    setStep(null);
    setHandoff("");
    setMicOn(true);
    setReconnecting(false);
    setUrgent(false);
    setTalkModeState("open");
    setNoisy(false);
    setNoiseHint(false);

    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;
    try {
      const audio: IsolationConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: AGC,
        channelCount: 1,
      };
      const supported: IsolationSupport =
        navigator.mediaDevices.getSupportedConstraints();
      if (supported.voiceIsolation) audio.voiceIsolation = { ideal: true };
      stream = await navigator.mediaDevices.getUserMedia({ audio });
      context = new AudioContext({ latencyHint: "interactive" });
      await context.resume();
      if (!mounted.current) {
        // Left the page while the permission prompt was open.
        stream.getTracks().forEach((track) => track.stop());
        void context.close().catch(() => {});
        return;
      }
      const line = openVoiceLine(context, stream, {
        onPlayback: (state: PlaybackState) => onPlayback(state),
        onConnection: (state) => onConnection(rt, state),
        onMicEnded: () =>
          finish(rt, {
            status: "error",
            error: assistantScreen.micLost,
            stop: true,
          }),
      });

      const rt: Runtime = {
        ws: null,
        callId: null,
        context,
        line,
        ready: false,
        closedByUs: false,
        socketDown: false,
        iceDown: false,
        attempt: 0,
        timers: {},
        micOn: true,
        talkMode: "open",
        openMic: true,
        holding: false,
        playing: false,
        loud: [],
        hintDone: false,
        step: null,
      };
      runtime.current = rt;
      active.assistant = line.voice;
      active.user = line.mic;

      function onPlayback(state: PlaybackState) {
        if (rt.closedByUs) return;
        rt.playing = state === "playing";
        if (state === "playing") setMode("speaking");
        else setMode((now) => (now === "speaking" ? "listening" : now));
      }

      /** Sustained loudness while the assistant is silent and the mic is open means a noisy place. */
      function sampleNoise(rt: Runtime) {
        if (
          rt.closedByUs ||
          !rt.ready ||
          rt.hintDone ||
          rt.talkMode !== "open" ||
          !rt.micOn ||
          rt.playing
        ) {
          rt.loud = [];
          return;
        }
        rt.loud.push(meters.user.level() > NOISE_LEVEL);
        if (rt.loud.length > NOISE_SAMPLES) rt.loud.shift();
        if (rt.loud.length < NOISE_SAMPLES) return;
        const ratio = rt.loud.filter(Boolean).length / rt.loud.length;
        if (ratio > NOISE_LOUD_RATIO) {
          setNoisy(true);
          setNoiseHint(true);
          rt.hintDone = true;
        }
      }

      function onConnection(_rt: Runtime, state: LineConnection) {
        if (rt.closedByUs) return;
        if (state === "failed") {
          finish(rt, {
            status: "error",
            error: assistantScreen.connectionLost,
            stop: true,
          });
        } else if (state === "disconnected") {
          rt.iceDown = true;
          syncReconnecting(rt);
          rt.timers.ice ??= setTimeout(
            () =>
              finish(rt, {
                status: "error",
                error: assistantScreen.connectionLost,
                stop: true,
              }),
            ICE_GRACE_MS,
          );
        } else if (state === "connected") {
          clearTimeout(rt.timers.ice);
          rt.timers.ice = undefined;
          rt.iceDown = false;
          syncReconnecting(rt);
        }
      }

      rt.timers.noise = setInterval(() => sampleNoise(rt), NOISE_SAMPLE_MS);

      attach(rt, false);
    } catch (cause) {
      stream?.getTracks().forEach((track) => track.stop());
      void context?.close().catch(() => {});
      const rt = runtime.current;
      if (rt) teardown(rt);
      setStatus("error");
      setError(friendly(cause));
    } finally {
      starting.current = false;
    }
  }, [attach, finish, teardown]);

  const end = useCallback(() => {
    const rt = runtime.current;
    if (!rt) return;
    finish(rt, { status: "ended", stop: true });
  }, [finish]);

  const toggleMic = useCallback(() => {
    const rt = runtime.current;
    if (!rt || rt.talkMode !== "open") return;
    rt.openMic = !rt.openMic;
    applyMic(rt);
  }, [applyMic]);

  /** Open: the mic is on (unless muted by hand). Hold: the mic is muted except while the button is held. */
  const setTalkMode = useCallback((next: TalkMode) => {
    const rt = runtime.current;
    if (!rt || rt.talkMode === next) return;
    clearTimeout(rt.timers.release);
    rt.timers.release = undefined;
    rt.talkMode = next;
    rt.holding = false;
    rt.openMic = true; // leaving hold always gives the caller an open mic
    rt.loud = [];
    if (next === "hold") rt.hintDone = true; // already chosen: no need to suggest it
    setTalkModeState(next);
    applyMic(rt);
  }, [applyMic]);

  const holdStart = useCallback(() => {
    const rt = runtime.current;
    if (!rt || rt.talkMode !== "hold") return;
    clearTimeout(rt.timers.release); // a press during the tail keeps the mic open
    rt.timers.release = undefined;
    if (rt.holding) return;
    rt.holding = true;
    applyMic(rt);
  }, [applyMic]);

  const holdEnd = useCallback(() => {
    const rt = runtime.current;
    if (!rt || rt.talkMode !== "hold" || !rt.holding || rt.timers.release)
      return;
    rt.timers.release = setTimeout(() => {
      rt.timers.release = undefined;
      rt.holding = false;
      applyMic(rt);
    }, HOLD_TAIL_MS);
  }, [applyMic]);

  const dismissNoiseHint = useCallback(() => setNoiseHint(false), []);

  /** The caller took the suggestion. */
  const acceptNoiseHint = useCallback(() => {
    setNoiseHint(false);
    setTalkMode("hold");
  }, [setTalkMode]);

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
      if (rt.ws?.readyState === WebSocket.OPEN) {
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

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const rt = runtime.current;
      if (rt) teardown(rt);
    };
  }, [teardown]);

  return {
    status,
    error,
    mode,
    phase,
    lines,
    step,
    handoff,
    micOn,
    reconnecting,
    notice,
    urgent,
    talkMode,
    noisy,
    noiseHint,
    meters,
    start,
    end,
    toggleMic,
    setTalkMode,
    holdStart,
    holdEnd,
    dismissNoiseHint,
    acceptNoiseHint,
    selectStep,
    onFrameLoad,
  };
}
