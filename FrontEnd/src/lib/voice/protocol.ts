// The voice call over plain HTTP (see BackEnd/app/voice/service.py for the flow).
//
// The audio, the captions and the backend model's function calls travel browser <-> OpenAI over WebRTC. The page
// relays each batch of function calls to /tools, where the server runs them and hands the results to OpenAI itself;
// the page only shows the screen messages it gets back. The page can send nothing to OpenAI (the session refuses it).
import { API_BASE } from "@/lib/api/client";

export type CallPhase = "triage" | "confirming" | "guiding" | "monitoring" | "handoff";

export const PHASE_LABEL: Record<CallPhase, string> = {
  triage: "Phân loại tình huống",
  confirming: "Xác nhận tình huống",
  guiding: "Đang hướng dẫn",
  monitoring: "Theo dõi nạn nhân",
  handoff: "Bàn giao",
};

export type StepInfo = {
  guideId: string;
  file: string;
  stepIndex: number;
  title: string;
  method: string;
  stepTitle: string;
  totalSteps: number;
};

/** What the server's tools put on screen. */
export type ScreenMessage =
  | { type: "signs"; awake: boolean | null; breathing: boolean | null; talking: boolean | null }
  | { type: "phase"; phase: CallPhase }
  | { type: "handoff"; summary: string }
  | ({ type: "step"; lines: string[] } & StepInfo);

export type CallInfo = {
  callId: string;
  /** The call's own credential: kept in memory only, never rendered or logged. */
  token: string;
  sdp: string;
  limitSeconds: number;
  warningSeconds: number;
  checkinSeconds: number;
  heartbeatSeconds: number;
};

export type RelayedCall = { callId: string; name: string; arguments: string };

export type EndReason = "stopped" | "completed" | "time_limit" | "disconnected" | "error";

export type NudgeKind = "greeting" | "checkin" | "ending_soon";

export class VoiceApiError extends Error {
  status: number;
  constructor(status: number) {
    super(`voice api ${status}`);
    this.status = status;
  }
}

const url = (path: string) => `${API_BASE}/api/voice${path}`;

async function json<T>(response: Response): Promise<T> {
  if (!response.ok) throw new VoiceApiError(response.status);
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

export async function startCall(sdp: string): Promise<CallInfo> {
  const response = await fetch(url("/calls"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ consent: true, sdp }),
    credentials: "omit",
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  return json<CallInfo>(response);
}

/** A request about one call, authorised by its token. `keepalive` lets it finish while the page is closing. */
export async function callApi<T>(
  call: Pick<CallInfo, "callId" | "token">,
  path: string,
  body?: unknown,
  { keepalive = false, timeoutMs = 15_000 } = {},
): Promise<T> {
  const response = await fetch(url(`/calls/${encodeURIComponent(call.callId)}${path}`), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${call.token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "omit",
    cache: "no-store",
    keepalive,
    signal: keepalive ? undefined : AbortSignal.timeout(timeoutMs),
  });
  return json<T>(response);
}

// ---- what arrives on the WebRTC data channel -------------------------------------------------------------------

export type LiveEvent =
  | { kind: "caption"; speaker: "user" | "assistant"; delta: string }
  | { kind: "call"; call: RelayedCall }
  | { kind: "response_done" };

/** The few Live events the page is allowed to receive, reduced to what the call needs. */
export function parseLiveEvent(raw: string): LiveEvent | null {
  let data: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    data = parsed as Record<string, unknown>;
  } catch {
    return null;
  }
  if (data.type === "session.input_transcript.delta" || data.type === "session.output_transcript.delta") {
    const delta = typeof data.delta === "string" ? data.delta : "";
    return { kind: "caption", speaker: data.type === "session.input_transcript.delta" ? "user" : "assistant", delta };
  }
  if (data.type !== "response.event" || !data.event || typeof data.event !== "object") return null;
  const event = data.event as Record<string, unknown>;
  if (event.type === "response.completed") return { kind: "response_done" };
  const item = event.item as Record<string, unknown> | undefined;
  if (
    event.type === "response.output_item.done" &&
    item?.type === "function_call" &&
    typeof item.call_id === "string" &&
    typeof item.name === "string"
  ) {
    const args = typeof item.arguments === "string" ? item.arguments : "{}";
    return { kind: "call", call: { callId: item.call_id, name: item.name, arguments: args } };
  }
  return null;
}

/** Live writes non-speech sounds in brackets ("[clear throat]"), sometimes split across fragments: drop them all. */
const NON_SPEECH = /\[[^\]]*(?:\]|$)|\]/g;

export function cleanCaption(text: string): string {
  return text.replace(NON_SPEECH, "").replace(/\s+/g, " ").trim();
}
