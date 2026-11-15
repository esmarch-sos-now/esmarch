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
  VoiceApiError,
  callApi,
  cleanCaption,
  parseLiveEvent,
  startCall,
  type CallInfo,
  type CallPhase,
  type EndReason,
  type NudgeKind,
  type RelayedCall,
  type ScreenMessage,
  type StepInfo,
} from "@/lib/voice/protocol";

export type CallStatus = "idle" | "connecting" | "live" | "ended" | "error";
export type Mode = "idle" | "listening" | "thinking" | "speaking";
export type Line = { key: string; speaker: "user" | "assistant"; text: string };

/** A WebRTC `disconnected` often heals by itself; past this it is treated as lost. */
const ICE_GRACE_MS = 8000;
const NOTICE_MS = 20_000;
/** Hold-to-talk keeps the microphone open a moment after release so the last syllable is not cut. */
const HOLD_TAIL_MS = 300;
/** After the hand-over: end once the assistant has been quiet this long, or after HANDOFF_MAX_MS at the latest. */
const HANDOFF_QUIET_MS = 1500;
const HANDOFF_MAX_MS = 25_000;
/** How often the silence timer looks (the server decides whether a check-in is really due). */
const CHECKIN_POLL_MS = 2000;

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
  /** The call and its credential, once the server has started it. */
  call: CallInfo | null;
  context: AudioContext;
  line: VoiceLine;
  ready: boolean;
  /** The call is over and released (by us, the server or a failure): every handler must ignore events from now on. */
  closedByUs: boolean;
  iceDown: boolean;
  /** Function calls of the backend response in progress, relayed together when it completes. */
  pendingCalls: RelayedCall[];
  /** Relays go out one after another, in order. */
  relays: Promise<void>;
  /** The hand-over was given: the call ends once it has been spoken. */
  handedOff: boolean;
  /** Last time anyone spoke or the backend acted (silence timer for check-ins). */
  lastActivity: number;
  /** Caption being built per speaker; a new one starts when the other side speaks. */
  caption: { speaker: "user" | "assistant" | null; index: number; raw: string };
  timers: {
    ice?: ReturnType<typeof setTimeout>;
    notice?: ReturnType<typeof setTimeout>;
    /** Pending mute after a hold-to-talk release. */
    release?: ReturnType<typeof setTimeout>;
    /** Interval sampling the mic level for the noisy-place hint (cleared with clearTimeout like the rest). */
    noise?: ReturnType<typeof setInterval>;
    heartbeat?: ReturnType<typeof setInterval>;
    checkin?: ReturnType<typeof setInterval>;
    warning?: ReturnType<typeof setTimeout>;
    limit?: ReturnType<typeof setTimeout>;
    handoffQuiet?: ReturnType<typeof setTimeout>;
    handoffMax?: ReturnType<typeof setTimeout>;
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
  message: Extract<ScreenMessage, { type: "step" }>,
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
  if (error instanceof VoiceApiError && (error.status === 503 || error.status === 429))
    return "Chưa kết nối được trợ lý (đang bận hoặc chưa sẵn sàng). Nếu khẩn cấp, hãy gọi 115 ngay.";
  return "Không mở được cuộc gọi. Nếu khẩn cấp, hãy gọi 115 ngay.";
}

type Outcome = {
  status: "ended" | "error";
  error?: string;
  notice?: string;
  /** Tell the server the call is over (it hangs up the paid session), with this reason. */
  end?: EndReason;
};

/**
 * One voice call with the first-aid assistant: microphone -> GPT-Live (WebRTC) -> assistant voice, with the
 * backend's tools run by our server over HTTP.
 * `frameRef` is the iframe of the 3D guide the assistant opens (it narrates itself and reports its own steps).
 * `onLive` runs once when the call goes live, for UI that should react to that moment.
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
  const teardown = useCallback((rt: Runtime, end?: EndReason) => {
    if (rt.closedByUs) return;
    rt.closedByUs = true;
    for (const timer of Object.values(rt.timers)) clearTimeout(timer);
    rt.timers = {};
    rt.line.stop();
    active.user = active.assistant = null;
    // Ask the server to hang up the paid session (it also does so by itself once heartbeats stop).
    if (end && rt.call)
      void callApi(rt.call, "/end", { reason: end }, { keepalive: true }).catch(() => {});
    void rt.context.close().catch(() => {});
    if (runtime.current === rt) runtime.current = null;
  }, []);

  /** The one way a call ends: release it, then show how it ended. */
  const finish = useCallback(
    (rt: Runtime, outcome: Outcome) => {
      if (rt.closedByUs) return;
      teardown(rt, outcome.end);
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

  const showNotice = useCallback((rt: Runtime, text: string) => {
    setNotice(text);
    clearTimeout(rt.timers.notice);
    rt.timers.notice = setTimeout(() => setNotice(null), NOTICE_MS);
  }, []);

  /** After the hand-over has been spoken (the assistant fell quiet), the call ends by itself. */
  const scheduleHandoffEnd = useCallback(
    (rt: Runtime) => {
      clearTimeout(rt.timers.handoffQuiet);
      if (!rt.handedOff || rt.playing) return;
      rt.timers.handoffQuiet = setTimeout(
        () => finish(rt, { status: "ended", end: "completed" }),
        HANDOFF_QUIET_MS,
      );
    },
    [finish],
  );

  const screen = useCallback(
    (rt: Runtime, messages: ScreenMessage[]) => {
      for (const message of messages) {
        switch (message.type) {
          case "phase":
            setPhase(message.phase);
            break;
          case "signs":
            setUrgent(message.awake === false || message.breathing === false);
            break;
          case "handoff":
            setHandoff(message.summary);
            break;
          case "step":
            show(rt, stepOf(message));
            break;
        }
      }
    },
    [show],
  );

  /** Send the completed response's function calls to the server, which answers OpenAI itself. */
  const relay = useCallback(
    (rt: Runtime) => {
      const calls = rt.pendingCalls.splice(0);
      if (!calls.length || !rt.call) return;
      const call = rt.call;
      const send = async () => {
        let lastError: unknown;
        for (let attempt = 0; attempt < 3 && !rt.closedByUs; attempt++) {
          try {
            const result = await callApi<{ messages: ScreenMessage[]; handoff: boolean }>(
              call,
              "/tools",
              { calls },
            );
            if (rt.closedByUs) return;
            screen(rt, result.messages);
            if (result.handoff && !rt.handedOff) {
              rt.handedOff = true;
              rt.timers.handoffMax = setTimeout(
                () => finish(rt, { status: "ended", end: "completed" }),
                HANDOFF_MAX_MS,
              );
            }
            return;
          } catch (cause) {
            lastError = cause;
            // A retry is answered from the server's stored results, so the backend never sees a call twice.
            // Only a call that is over (410) or not ours (401/404) is not worth another try.
            if (cause instanceof VoiceApiError && [401, 404, 410].includes(cause.status)) break;
            await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
          }
        }
        if (rt.closedByUs) return;
        if (lastError instanceof VoiceApiError && lastError.status === 410) {
          finish(rt, { status: "ended", notice: assistantScreen.timeLimit });
          return;
        }
        setError(assistantScreen.problem);
      };
      rt.relays = rt.relays.then(send, send);
    },
    [screen, finish],
  );

  const nudge = useCallback(
    async (rt: Runtime, kind: NudgeKind) => {
      if (!rt.call || rt.closedByUs) return null;
      try {
        return await callApi<{ said: boolean; seconds?: number }>(rt.call, "/nudge", { kind });
      } catch {
        return null; // a missed nudge is not worth interrupting the call for
      }
    },
    [],
  );

  const onLiveEvent = useCallback(
    (rt: Runtime, raw: string) => {
      if (rt.closedByUs) return;
      const event = parseLiveEvent(raw);
      if (!event) return;
      switch (event.kind) {
        case "caption": {
          rt.lastActivity = performance.now();
          if (rt.caption.speaker !== event.speaker) {
            rt.caption = { speaker: event.speaker, index: rt.caption.index + 1, raw: "" };
          }
          // Fragments can split a word, so the raw text is joined as is and cleaned as a whole.
          rt.caption.raw += event.delta;
          const key = `${event.speaker}:${rt.caption.index}`;
          const text = cleanCaption(rt.caption.raw);
          if (!text) break;
          setLines((current) => {
            const at = current.findIndex((line) => line.key === key);
            if (at < 0) return [...current, { key, speaker: event.speaker, text }];
            const next = [...current];
            next[at] = { ...next[at], text };
            return next;
          });
          break;
        }
        case "call":
          rt.lastActivity = performance.now();
          rt.pendingCalls.push(event.call);
          setMode((now) => (now === "speaking" ? now : "thinking"));
          break;
        case "response_done":
          relay(rt);
          break;
      }
    },
    [relay],
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
        onConnection: (state) => onConnection(state),
        onMicEnded: () =>
          finish(rt, { status: "error", error: assistantScreen.micLost, end: "error" }),
        onEvent: (raw) => onLiveEvent(rt, raw),
        onChannelClosed: () => {
          if (rt.closedByUs) return;
          // OpenAI closed the session: the hand-over ended it, the server hung it up (time limit), or the link
          // was lost. The server knows which: a call it ended answers 410.
          if (rt.handedOff) {
            finish(rt, { status: "ended" });
            return;
          }
          const lost = () =>
            finish(rt, { status: "error", error: assistantScreen.connectionLost, end: "disconnected" });
          if (!rt.call) return lost();
          void callApi(rt.call, "/heartbeat").then(lost, (cause: unknown) => {
            if (cause instanceof VoiceApiError && cause.status === 410)
              finish(rt, { status: "ended", notice: assistantScreen.timeLimit });
            else lost();
          });
        },
      });

      const rt: Runtime = {
        call: null,
        context,
        line,
        ready: false,
        closedByUs: false,
        iceDown: false,
        pendingCalls: [],
        relays: Promise.resolve(),
        handedOff: false,
        lastActivity: performance.now(),
        caption: { speaker: null, index: 0, raw: "" },
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
        rt.lastActivity = performance.now();
        if (state === "playing") setMode("speaking");
        else setMode((now) => (now === "speaking" ? "listening" : now));
        if (rt.handedOff) scheduleHandoffEnd(rt);
      }

      /** Sustained loudness while the assistant is silent and the mic is open means a noisy place. */
      function sampleNoise() {
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

      function onConnection(state: LineConnection) {
        if (rt.closedByUs) return;
        if (state === "failed") {
          finish(rt, { status: "error", error: assistantScreen.connectionLost, end: "disconnected" });
        } else if (state === "disconnected") {
          rt.iceDown = true;
          setReconnecting(true);
          rt.timers.ice ??= setTimeout(
            () => finish(rt, { status: "error", error: assistantScreen.connectionLost, end: "disconnected" }),
            ICE_GRACE_MS,
          );
        } else if (state === "connected") {
          clearTimeout(rt.timers.ice);
          rt.timers.ice = undefined;
          rt.iceDown = false;
          setReconnecting(false);
          if (!rt.ready) goLive();
        }
      }

      /** The audio is flowing: greet, and start the call's clocks (the server enforces the same limits itself). */
      function goLive() {
        const call = rt.call;
        if (!call || rt.ready || rt.closedByUs) return;
        rt.ready = true;
        setStatus("live");
        setMode("listening");
        onLiveRef.current?.();
        void nudge(rt, "greeting");
        rt.timers.heartbeat = setInterval(() => {
          void callApi(call, "/heartbeat").catch((cause: unknown) => {
            if (cause instanceof VoiceApiError && cause.status === 410)
              finish(rt, { status: "ended", notice: assistantScreen.timeLimit });
          });
        }, call.heartbeatSeconds * 1000);
        if (call.checkinSeconds > 0) {
          rt.timers.checkin = setInterval(() => {
            const quiet = performance.now() - rt.lastActivity;
            if (rt.playing || rt.pendingCalls.length || quiet < call.checkinSeconds * 1000) return;
            rt.lastActivity = performance.now();
            void nudge(rt, "checkin");
          }, CHECKIN_POLL_MS);
        }
        if (call.warningSeconds > 0 && call.warningSeconds < call.limitSeconds) {
          rt.timers.warning = setTimeout(async () => {
            const said = await nudge(rt, "ending_soon");
            if (!said?.said || rt.closedByUs) return;
            const seconds = said.seconds ?? call.warningSeconds;
            const left =
              seconds >= 90 ? `${Math.round(seconds / 60)} phút` : `${Math.max(1, Math.round(seconds))} giây`;
            showNotice(rt, `${assistantScreen.endingSoon} (còn khoảng ${left})`);
          }, (call.limitSeconds - call.warningSeconds) * 1000);
        }
        rt.timers.limit = setTimeout(
          () => finish(rt, { status: "ended", notice: assistantScreen.timeLimit, end: "time_limit" }),
          call.limitSeconds * 1000,
        );
      }

      rt.timers.noise = setInterval(sampleNoise, NOISE_SAMPLE_MS);

      const offer = await line.offer();
      const call = await startCall(offer);
      if (rt.closedByUs) {
        void callApi(call, "/end", { reason: "stopped" }, { keepalive: true }).catch(() => {});
        return;
      }
      rt.call = call;
      await line.accept(call.sdp);
    } catch (cause) {
      stream?.getTracks().forEach((track) => track.stop());
      void context?.close().catch(() => {});
      const rt = runtime.current;
      if (rt) teardown(rt, "error");
      setStatus("error");
      setError(friendly(cause));
    } finally {
      starting.current = false;
    }
  }, [finish, teardown, onLiveEvent, nudge, scheduleHandoffEnd, showNotice]);

  const end = useCallback(() => {
    const rt = runtime.current;
    if (!rt) return;
    finish(rt, { status: "ended", end: "stopped" });
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

  /** The caller picked a step by hand (progress bar): move the guide and tell the server. */
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
      if (rt.call) {
        void callApi<{ messages: ScreenMessage[] }>(rt.call, "/step", {
          guideId: current.guideId,
          stepIndex: index,
        })
          .then((result) => {
            if (!rt.closedByUs)
              screen(rt, result.messages.filter((m) => m.type !== "step"));
          })
          .catch(() => {});
      }
      show(rt, { ...current, stepIndex: index, stepTitle: "" }, push);
    },
    [show, screen],
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

  // Closing the tab ends the paid session at once (the server would otherwise wait for heartbeats to stop).
  useEffect(() => {
    const onHide = () => {
      const rt = runtime.current;
      if (rt) teardown(rt, "disconnected");
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [teardown]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const rt = runtime.current;
      if (rt) teardown(rt, "stopped");
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
