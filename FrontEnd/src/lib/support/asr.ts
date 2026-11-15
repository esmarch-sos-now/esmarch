import { API_BASE } from "@/lib/api/client";

// Speech -> text for the "Mô tả tình huống" box: the recording goes to the backend, which asks OpenAI speech-to-text
// (gpt-transcribe) and stores nothing. The voice button shows only with NEXT_PUBLIC_ASR_ENABLED=true; the backend
// also needs OPENAI_API_KEY, otherwise it answers 503 and the form keeps the recording and asks for typed text.
export const ASR_ENABLED = process.env.NEXT_PUBLIC_ASR_ENABLED === "true";

/** Resolves to the transcript (possibly empty); throws when the backend is unreachable or fails. */
export async function transcribeSpeech(audio: Blob): Promise<string> {
  const form = new FormData();
  // MediaRecorder output as is (WebM/Ogg Opus, or MP4 on Safari): a 60 s note stays well under the upload limit.
  form.append("file", audio, "description");
  const response = await fetch(`${API_BASE}/api/support/transcribe`, { method: "POST", credentials: "omit", body: form });
  if (!response.ok) throw new Error(`ASR ${response.status}`);
  const body = (await response.json()) as { text?: string };
  return (body.text ?? "").trim();
}
