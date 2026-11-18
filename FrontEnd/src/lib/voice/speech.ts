// Nhận giọng nói ngay trong trình duyệt (Web Speech API): không qua máy chủ của mình, không cần AI.
// Chrome và Edge có; Firefox thì không, Safari hỗ trợ kém. Chrome gửi âm thanh lên Google để nhận dạng, nên cần mạng.

export type SpeechResult = { isFinal: boolean; 0: { transcript: string } };

export type BrowserSpeech = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { resultIndex: number; results: ArrayLike<SpeechResult> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

export function speechCtor(): (new () => BrowserSpeech) | null {
  if (typeof window === "undefined") return null;
  const host = window as Window & { SpeechRecognition?: new () => BrowserSpeech; webkitSpeechRecognition?: new () => BrowserSpeech };
  return host.SpeechRecognition ?? host.webkitSpeechRecognition ?? null;
}

/** The browser refused the microphone (asked and declined, or blocked by the site settings). */
export const isMicDenied = (error: string) => error === "not-allowed" || error === "service-not-allowed";

// ---- lệnh trên màn hướng dẫn từng bước ----------------------------------------------------------------------------

export type StepCommand = "next" | "repeat" | "previous" | "call115";

// Thứ tự kiểm tra quan trọng: "quay lại", "nhắc lại" đều có chữ "lại", nên xét các lệnh cụ thể trước "tiếp"
const COMMANDS: [StepCommand, string[]][] = [
  ["call115", ["gọi 115", "gọi một một năm", "cấp cứu", "goi 115", "cap cuu"]],
  ["repeat", ["nhắc lại", "đọc lại", "lặp lại", "nói lại", "nghe lại", "nhac lai", "doc lai", "lap lai", "noi lai"]],
  ["previous", ["quay lại", "bước trước", "trở lại", "lùi lại", "quay lai", "buoc truoc", "tro lai"]],
  ["next", ["xong", "tiếp", "bước sau", "kế tiếp", "tiep", "buoc sau", "next"]],
];

/** The command in what the caller said, if any ("xong rồi" is next, "đọc lại đi" is repeat). */
export function stepCommand(said: string): StepCommand | null {
  const text = said.toLowerCase().normalize("NFC");
  for (const [command, words] of COMMANDS) {
    if (words.some((word) => text.includes(word))) return command;
  }
  return null;
}
