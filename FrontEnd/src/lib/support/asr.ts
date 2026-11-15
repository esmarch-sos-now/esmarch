// Speech -> text for the "Mô tả tình huống" box, through the local Vietnamese ASR demo service (demo/asr, Fun-ASR,
// CPU). The audio only goes to that service. Voice input is shown only when NEXT_PUBLIC_ASR_URL is set (a deployed
// site cannot reach a service on the visitor's 127.0.0.1), e.g. NEXT_PUBLIC_ASR_URL=http://127.0.0.1:7860/api/transcribe.
const ASR_URL = process.env.NEXT_PUBLIC_ASR_URL ?? "";
export const ASR_ENABLED = ASR_URL !== "";
const SAMPLE_RATE = 16_000;

/** MediaRecorder gives webm/ogg; the ASR service reads WAV, so decode and re-encode as 16 kHz mono PCM. */
async function toWav16k(blob: Blob): Promise<Blob> {
  const decoder = new AudioContext();
  const decoded = await decoder.decodeAudioData(await blob.arrayBuffer()).finally(() => void decoder.close());
  const frames = Math.max(1, Math.ceil(decoded.duration * SAMPLE_RATE));
  const offline = new OfflineAudioContext(1, frames, SAMPLE_RATE);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const samples = (await offline.startRendering()).getChannelData(0);

  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeText = (offset: number, text: string) => [...text].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  writeText(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, index) => view.setInt16(44 + index * 2, Math.max(-1, Math.min(1, sample)) * 0x7fff, true));
  return new Blob([buffer], { type: "audio/wav" });
}

/** Resolves to the transcript (possibly empty); throws when the service is unreachable or fails. */
export async function transcribeSpeech(audio: Blob): Promise<string> {
  const form = new FormData();
  form.append("file", await toWav16k(audio), "description.wav");
  form.append("models", "funasr");
  const response = await fetch(ASR_URL, { method: "POST", body: form });
  if (!response.ok) throw new Error(`ASR ${response.status}`);
  const body = (await response.json()) as { results?: { text?: string; error?: string }[] };
  const first = body.results?.[0];
  if (!first || first.error) throw new Error(first?.error ?? "ASR returned nothing");
  return (first.text ?? "").trim();
}
