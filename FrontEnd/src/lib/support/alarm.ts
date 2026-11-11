"use client";

// Chuông báo cho người hỗ trợ ("Sẵn sàng hỗ trợ").
// Điện thoại chỉ cho trang web phát tiếng sau một lần chạm của người dùng, nên bộ phát (AudioContext) được tạo và
// "mở khoá" ngay khi bấm "Bật sẵn sàng" (`unlockAlarm`, gọi trong sự kiện bấm), rồi dùng lại cho mọi lần chuông sau.
// iPhone: Web Audio bị tắt theo nút gạt im lặng; Safari 16.4+ cho đặt `navigator.audioSession.type = "playback"` để
// chuông vẫn kêu. iPhone không hỗ trợ rung cho trang web; Android Chrome rung được.

type AudioSessionNavigator = Navigator & { audioSession?: { type: string } };

let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (ctx) return ctx;
  try {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    ctx = AudioCtx ? new AudioCtx() : null;
  } catch {
    ctx = null;
  }
  return ctx;
}

function beep(audio: AudioContext, at: number, frequency: number, length = 0.22, volume = 0.35) {
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = "square";
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(volume, audio.currentTime + at);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + at + length);
  osc.connect(gain).connect(audio.destination);
  osc.start(audio.currentTime + at);
  osc.stop(audio.currentTime + at + length + 0.02);
}

/** Call inside a click/tap handler: creates and resumes the audio context and plays a short confirmation beep. */
export function unlockAlarm() {
  const nav = navigator as AudioSessionNavigator;
  if (nav.audioSession) {
    try {
      nav.audioSession.type = "playback"; // iPhone: ring even with the silent switch on
    } catch {
      // older Safari
    }
  }
  const audio = context();
  if (!audio) return;
  void audio.resume().catch(() => undefined);
  beep(audio, 0, 660, 0.12, 0.25);
}

/** One ring: three loud beeps and a vibration. */
export function ring() {
  const audio = context();
  if (audio) {
    void audio.resume().catch(() => undefined);
    [0, 0.3, 0.6].forEach((at) => beep(audio, at, 988));
  }
  try {
    navigator.vibrate?.([400, 150, 400, 150, 400]);
  } catch {
    // not supported (iPhone)
  }
}

/** System notification when the page is in the background (Android Chrome needs the service-worker API for this). */
export function notifyInBackground(title: string, body: string) {
  if (!("Notification" in window) || Notification.permission !== "granted" || document.visibilityState === "visible") return;
  try {
    new Notification(title, { body, tag: "sos-support", requireInteraction: true });
  } catch {
    void navigator.serviceWorker?.getRegistration().then((registration) =>
      registration?.showNotification(title, { body, tag: "sos-support", requireInteraction: true }),
    );
  }
}
