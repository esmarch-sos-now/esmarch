// Messages of the realtime voice WebSocket (signaling and screen messages; the audio itself is WebRTC) (see BackEnd/app/voice/call.py for the contract).

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

export type ServerMessage =
  | { type: "answer"; sdp: string }
  | { type: "ready" }
  | { type: "transcript"; speaker: "user" | "assistant"; index: number; text: string }
  | { type: "phase"; phase: CallPhase }
  | { type: "handoff"; summary: string }
  | ({ type: "step"; lines: string[] } & StepInfo)
  | { type: "turn_complete" }
  | { type: "error"; message: string }
  | { type: "ended"; reason: string };

// Dev default: the FastAPI backend on the same host. Production sets NEXT_PUBLIC_VOICE_WS_URL (wss://…/api/voice/ws).
// A Next.js rewrite cannot be relied on for WebSockets, so the browser connects to the backend directly.
export function voiceSocketUrl(): string {
  const configured = process.env.NEXT_PUBLIC_VOICE_WS_URL;
  if (configured) return configured;
  const secure = window.location.protocol === "https:";
  return `${secure ? "wss" : "ws"}://${window.location.hostname}:8000/api/voice/ws`;
}

export function parseServerMessage(raw: string): ServerMessage | null {
  try {
    const data: unknown = JSON.parse(raw);
    return data && typeof data === "object" && typeof (data as { type?: unknown }).type === "string"
      ? (data as ServerMessage)
      : null;
  } catch {
    return null;
  }
}
