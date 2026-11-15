/** Level and frequency bands of an audio node, read on demand (animation frames), never through React state. */
export class Meter {
  private readonly analyser: AnalyserNode;
  private readonly bytes: Uint8Array<ArrayBuffer>;

  constructor(context: AudioContext) {
    this.analyser = context.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.smoothingTimeConstant = 0.6;
    this.bytes = new Uint8Array(this.analyser.frequencyBinCount);
  }

  get input(): AudioNode {
    return this.analyser;
  }

  /** 0..1 loudness. */
  level(): number {
    this.analyser.getByteFrequencyData(this.bytes);
    let sum = 0;
    for (const value of this.bytes) sum += value * value;
    return Math.min(1, Math.sqrt(sum / this.bytes.length) / 128);
  }

  /** `count` bands of 0..1, lowest frequencies first (voice range only). */
  bands(count: number): number[] {
    this.analyser.getByteFrequencyData(this.bytes);
    const usable = Math.floor(this.bytes.length * 0.35);
    const size = Math.max(1, Math.floor(usable / count));
    return Array.from({ length: count }, (_, band) => {
      let sum = 0;
      for (let i = 0; i < size; i++) sum += this.bytes[band * size + i] ?? 0;
      return sum / size / 255;
    });
  }
}

export type PlaybackState = "idle" | "playing";

/** The assistant counts as audible above this loudness (0..1) ... */
const AUDIBLE_LEVEL = 0.02;
/** ... and as finished once it has been quieter than that for this long (gaps between words). */
const QUIET_MS = 250;

/** Health of the WebRTC link, as far as the call cares: `disconnected` may heal by itself, `failed` will not. */
export type LineConnection = "connecting" | "connected" | "disconnected" | "failed";

export type LineEvents = {
  onPlayback: (state: PlaybackState) => void;
  onConnection: (state: LineConnection) => void;
  /** The microphone track ended on its own (device unplugged, permission revoked). */
  onMicEnded: () => void;
  /** A message from OpenAI on the call's data channel (captions, the backend's function calls). */
  onEvent: (raw: string) => void;
  /** The data channel closed: the session is over (hung up, timed out or lost). */
  onChannelClosed: () => void;
};

export type VoiceLine = {
  mic: Meter;
  voice: Meter;
  /** The SDP offer for the call, once the connection has gathered its network candidates. */
  offer: () => Promise<string>;
  accept: (answerSdp: string) => Promise<void>;
  /** Mute or unmute what the server hears. */
  setMuted: (muted: boolean) => void;
  stop: () => void;
};

/**
 * The call's audio: the microphone goes to GPT-Live and its voice comes back over one WebRTC connection (the
 * browser talks to OpenAI directly; the server only starts the session and runs the tools). A data channel carries
 * captions and the backend's function calls down to the page; the session refuses anything the page sends on it.
 * Whether the assistant is audible is measured here, since Live reports no speech events.
 */
export function openVoiceLine(
  context: AudioContext,
  stream: MediaStream,
  { onPlayback, onConnection, onMicEnded, onEvent, onChannelClosed }: LineEvents,
): VoiceLine {
  const pc = new RTCPeerConnection();
  const channel = pc.createDataChannel("oai-events");
  channel.onmessage = (event: MessageEvent) => {
    if (typeof event.data === "string") onEvent(event.data);
  };
  channel.onclose = onChannelClosed;
  const mic = new Meter(context);
  const voice = new Meter(context);
  context.createMediaStreamSource(stream).connect(mic.input);
  for (const track of stream.getAudioTracks()) {
    pc.addTrack(track, stream);
    track.onended = onMicEnded;
  }

  // Without this a dead ICE connection is silent: nothing else tells the page the audio stopped flowing.
  const report = () => {
    if (pc.connectionState === "failed" || pc.iceConnectionState === "failed") onConnection("failed");
    else if (pc.connectionState === "disconnected" || pc.iceConnectionState === "disconnected") onConnection("disconnected");
    else if (pc.connectionState === "connected") onConnection("connected");
    else onConnection("connecting");
  };
  pc.addEventListener("connectionstatechange", report);
  pc.addEventListener("iceconnectionstatechange", report);

  // Remote audio must be attached to a media element to flow at all; the meter taps the same stream.
  const element = new Audio();
  element.autoplay = true;
  let state: PlaybackState = "idle";
  let quietSince = 0;
  const poll = setInterval(() => {
    const loud = voice.level() > AUDIBLE_LEVEL;
    const now = performance.now();
    if (loud) quietSince = 0;
    else if (quietSince === 0) quietSince = now;
    const next: PlaybackState = loud || (state === "playing" && now - quietSince < QUIET_MS) ? "playing" : "idle";
    if (next !== state) {
      state = next;
      onPlayback(next);
    }
  }, 50);

  pc.ontrack = (event) => {
    const [remote] = event.streams;
    if (!remote) return;
    element.srcObject = remote;
    context.createMediaStreamSource(remote).connect(voice.input);
  };

  return {
    mic,
    voice,
    offer: async () => {
      await pc.setLocalDescription(await pc.createOffer());
      if (pc.iceGatheringState !== "complete") {
        await new Promise<void>((resolve) => {
          const done = () => {
            if (pc.iceGatheringState === "complete") {
              pc.removeEventListener("icegatheringstatechange", done);
              resolve();
            }
          };
          pc.addEventListener("icegatheringstatechange", done);
          setTimeout(resolve, 2000); // a slow candidate must not hold the call
        });
      }
      return pc.localDescription?.sdp ?? "";
    },
    accept: (sdp) => pc.setRemoteDescription({ type: "answer", sdp }),
    setMuted: (muted) => {
      for (const track of stream.getAudioTracks()) track.enabled = !muted;
    },
    stop: () => {
      clearInterval(poll);
      channel.onmessage = channel.onclose = null;
      pc.removeEventListener("connectionstatechange", report);
      pc.removeEventListener("iceconnectionstatechange", report);
      for (const track of stream.getAudioTracks()) track.onended = null;
      element.srcObject = null;
      pc.close();
      for (const track of stream.getTracks()) track.stop();
    },
  };
}
