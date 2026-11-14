"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, Mic, Square, Trash2, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { transcribeSpeech } from "@/lib/support/asr";

export type IncidentReport = {
  text: string;
  audio: { blob: Blob; url: string } | null;
  photos: { file: File; url: string }[];
  video: { file: File; url: string } | null;
};

export const emptyReport: IncidentReport = { text: "", audio: null, photos: [], video: null };

/** The situation must be described by typing or by voice; photos and video are optional. */
export const hasDescription = (report: IncidentReport) => report.text.trim().length > 0 || report.audio !== null;

const MAX_PHOTOS = 3;
const MAX_AUDIO_SECONDS = 60;
const MAX_VIDEO_BYTES = 25 * 1024 * 1024;

const formatClock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

export default function IncidentReportFields({ value, onChange }: { value: IncidentReport; onChange: (next: IncidentReport) => void }) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [note, setNote] = useState("");
  const [transcribing, setTranscribing] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  }, [value]);

  const stopTicker = () => {
    if (ticker.current) clearInterval(ticker.current);
    ticker.current = null;
  };

  // Release the microphone and the preview URLs when the form goes away.
  useEffect(
    () => () => {
      stopTicker();
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
      const current = latest.current;
      if (current.audio) URL.revokeObjectURL(current.audio.url);
      current.photos.forEach((photo) => URL.revokeObjectURL(photo.url));
      if (current.video) URL.revokeObjectURL(current.video.url);
    },
    [],
  );

  // Fills the description box with what was said; the user can still edit it. Failure keeps the voice note.
  const transcribe = async (blob: Blob) => {
    setTranscribing(true);
    try {
      const text = await transcribeSpeech(blob);
      if (!text) return setNote("Chưa nhận ra giọng nói. Hãy ghi âm lại hoặc nhập bằng chữ.");
      const current = latest.current;
      onChange({ ...current, text: current.text.trim() ? `${current.text.trim()}\n${text}` : text });
    } catch {
      setNote("Chưa chuyển được giọng nói thành chữ (dịch vụ ASR chưa chạy). Bản ghi âm vẫn được giữ; bạn có thể nhập thêm bằng chữ.");
    } finally {
      setTranscribing(false);
    }
  };

  const startRecording = async () => {
    setNote("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      return setNote("Trình duyệt này chưa hỗ trợ ghi âm. Hãy nhập mô tả bằng chữ.");
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = media;
      const chunks: Blob[] = [];
      const next = new MediaRecorder(media);
      next.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      next.onstop = () => {
        media.getTracks().forEach((track) => track.stop());
        stopTicker();
        setRecording(false);
        if (chunks.length === 0) return;
        const blob = new Blob(chunks, { type: next.mimeType || "audio/webm" });
        const previous = latest.current.audio;
        if (previous) URL.revokeObjectURL(previous.url);
        onChange({ ...latest.current, audio: { blob, url: URL.createObjectURL(blob) } });
        void transcribe(blob);
      };
      recorder.current = next;
      next.start();
      setSeconds(0);
      setRecording(true);
      ticker.current = setInterval(() => {
        setSeconds((current) => {
          if (current + 1 >= MAX_AUDIO_SECONDS && next.state === "recording") next.stop();
          return current + 1;
        });
      }, 1000);
    } catch {
      setNote("Chưa được phép dùng micro. Hãy cho phép micro trong trình duyệt hoặc nhập mô tả bằng chữ.");
    }
  };

  const stopRecording = () => {
    if (recorder.current?.state === "recording") recorder.current.stop();
  };

  const removeAudio = () => {
    if (value.audio) URL.revokeObjectURL(value.audio.url);
    onChange({ ...value, audio: null });
  };

  const addPhotos = (files: FileList | null) => {
    setNote("");
    if (!files) return;
    const picked = Array.from(files)
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, MAX_PHOTOS - value.photos.length);
    onChange({ ...value, photos: [...value.photos, ...picked.map((file) => ({ file, url: URL.createObjectURL(file) }))] });
  };

  const removePhoto = (index: number) => {
    URL.revokeObjectURL(value.photos[index].url);
    onChange({ ...value, photos: value.photos.filter((_, position) => position !== index) });
  };

  const setVideo = (files: FileList | null) => {
    setNote("");
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("video/")) return setNote("Hãy chọn một tệp video.");
    if (file.size > MAX_VIDEO_BYTES) return setNote("Video quá lớn (tối đa 50 MB).");
    if (value.video) URL.revokeObjectURL(value.video.url);
    onChange({ ...value, video: { file, url: URL.createObjectURL(file) } });
  };

  const removeVideo = () => {
    if (value.video) URL.revokeObjectURL(value.video.url);
    onChange({ ...value, video: null });
  };

  const pick =
    "inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border border-line bg-white px-4 text-sm font-semibold text-ink hover:bg-[#f6f6f6] [&_svg]:size-4";

  return (
    <div className="grid items-start gap-5 lg:grid-cols-2 lg:gap-8">
      <fieldset className="grid gap-2.5">
        <legend className="text-sm font-bold text-ink">
          Mô tả tình huống <span className="text-brand">*</span>
        </legend>
        <p className="-mt-1 text-xs text-muted-foreground">Bắt buộc: nhập chữ hoặc ghi âm (hoặc cả hai).</p>
        <textarea
          value={value.text}
          onChange={(event) => onChange({ ...value, text: event.target.value })}
          rows={3}
          maxLength={500}
          placeholder="Ví dụ: Người lớn tuổi ngã, không trả lời, đang thở yếu…"
          className="min-h-24 resize-y rounded-xl border border-line px-3.5 py-3 text-base outline-none focus:border-brand"
        />
        <div className="flex flex-wrap items-center gap-3">
          {recording ? (
            <Button type="button" onClick={stopRecording} className="h-11 rounded-full bg-brand font-bold [&_svg]:size-4">
              <Square aria-hidden="true" className="fill-current" /> Dừng ghi · {formatClock(seconds)}
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={startRecording} className="h-11 rounded-full font-semibold [&_svg]:size-4">
              <Mic aria-hidden="true" /> {value.audio ? "Ghi âm lại" : "Ghi âm mô tả"}
            </Button>
          )}
          {transcribing && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground" role="status">
              <Loader2 aria-hidden="true" className="size-3.5 animate-spin motion-reduce:animate-none" /> Đang chuyển giọng nói thành chữ…
            </span>
          )}
          {recording && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand" role="status">
              <span className="size-2 animate-pulse rounded-full bg-brand motion-reduce:animate-none" /> Đang ghi âm…
            </span>
          )}
        </div>
        {value.audio && !recording && (
          <div className="flex items-center gap-2">
            <audio controls src={value.audio.url} className="h-10 min-w-0 flex-1" />
            <button
              type="button"
              onClick={removeAudio}
              aria-label="Xoá bản ghi âm"
              className="grid size-9 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-[#f6f6f6] [&_svg]:size-4"
            >
              <Trash2 aria-hidden="true" />
            </button>
          </div>
        )}
      </fieldset>

      <fieldset className="grid gap-2.5">
        <legend className="text-sm font-bold text-ink">
          Ảnh hoặc video hiện trường <span className="font-normal text-muted-foreground">(không bắt buộc)</span>
        </legend>
        <div className="flex flex-wrap gap-2.5">
          <label className={pick}>
            <Camera aria-hidden="true" /> Chụp ảnh
            <input
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="sr-only"
              disabled={value.photos.length >= MAX_PHOTOS}
              onChange={(event) => {
                addPhotos(event.target.files);
                event.target.value = "";
              }}
            />
          </label>
          <label className={pick}>
            <Video aria-hidden="true" /> Quay / gửi video
            <input
              type="file"
              accept="video/*"
              capture="environment"
              className="sr-only"
              onChange={(event) => {
                setVideo(event.target.files);
                event.target.value = "";
              }}
            />
          </label>
        </div>
        {(value.photos.length > 0 || value.video) && (
          <div className="flex flex-wrap gap-2.5">
            {value.photos.map((photo, index) => (
              <div key={photo.url} className="relative size-24 overflow-hidden rounded-xl border border-line">
                <img src={photo.url} alt={`Ảnh hiện trường ${index + 1}`} className="size-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(index)}
                  aria-label={`Xoá ảnh ${index + 1}`}
                  className="absolute top-1 right-1 grid size-6 cursor-pointer place-items-center rounded-full bg-black/60 text-white [&_svg]:size-3.5"
                >
                  <X aria-hidden="true" />
                </button>
              </div>
            ))}
            {value.video && (
              <div className="relative h-24 w-40 overflow-hidden rounded-xl border border-line bg-black">
                <video src={value.video.url} muted playsInline controls className="size-full object-cover" />
                <button
                  type="button"
                  onClick={removeVideo}
                  aria-label="Xoá video"
                  className="absolute top-1 right-1 grid size-6 cursor-pointer place-items-center rounded-full bg-black/60 text-white [&_svg]:size-3.5"
                >
                  <X aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Tối đa {MAX_PHOTOS} ảnh và 1 video (50 MB). Trên điện thoại, nút sẽ mở camera; trên máy tính sẽ mở hộp chọn tệp.
        </p>
      </fieldset>

      {note && (
        <p className="text-sm font-semibold text-brand lg:col-span-2" role="alert">
          {note}
        </p>
      )}
    </div>
  );
}
