"use client";

import { useEffect, useRef, useState } from "react";
import { HandHeart, ImageIcon, MapPin, Siren, Video, X } from "lucide-react";
import { supportCopy } from "@/content/app";
import { distanceBeforeAccepting, type ResponderRequest } from "@/lib/support/protocol";

const formatClock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/**
 * Full-screen "incoming urgent call" for a supporter: who needs help, where, what happened, the scene photos, how long
 * is left to answer, and two big buttons. Shown for the newest open request; `others` counts the requests behind it.
 * `photos` and `video` are URLs the backend serves to invited responders while the request is open; a file that fails to
 * load is hidden and a note explains it.
 */
export default function IncomingCallOverlay({
  offer,
  photos = [],
  video,
  others = 0,
  error = "",
  onAccept,
  onDecline,
}: {
  offer: ResponderRequest;
  photos?: string[];
  /** URL of the requester's video, when there is one. */
  video?: string;
  others?: number;
  /** A failed accept/decline must be visible here: this screen covers the page that would show it. */
  error?: string;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [failed, setFailed] = useState<string[]>([]);
  const [videoFailed, setVideoFailed] = useState(false);
  const [enlarged, setEnlarged] = useState<string | null>(null);
  const acceptButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const expires = new Date(offer.expiresAt).getTime();
    const tick = () => setSecondsLeft(Math.max(0, Math.round((expires - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [offer.expiresAt]);

  // The supporter's first reach is the "accept" button.
  useEffect(() => acceptButton.current?.focus(), [offer.id]);

  // Escape closes the enlarged photo first.
  useEffect(() => {
    if (!enlarged) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setEnlarged(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enlarged]);

  const where = distanceBeforeAccepting(offer) ?? supportCopy.responder.placeAfterAccepting;
  const shown = photos.filter((url) => !failed.includes(url));
  const photosHidden = photos.length > 0 && shown.length === 0;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="incoming-call-title"
      className="fixed inset-0 z-[100] flex animate-step-rise flex-col items-center overflow-y-auto bg-[radial-gradient(120%_80%_at_50%_0%,#7a1d0e_0%,#2b0d08_55%,#140504_100%)] px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))] text-white"
    >
      <div className="my-auto flex w-full max-w-md flex-col gap-5 lg:max-w-4xl">
        <div className="grid items-center gap-5 lg:grid-cols-2 lg:gap-10">
          <div className="flex flex-col items-center gap-3.5 text-center">
            <p className="inline-flex items-center gap-2 text-xs font-bold tracking-[.18em] text-white/80 uppercase">
              <span className="size-2 animate-pulse rounded-full bg-[#ff6a4d] motion-reduce:animate-none" /> Cuộc gọi khẩn cấp
            </p>

            <span className="relative grid size-24 place-items-center" aria-hidden="true">
              <span className="absolute inset-0 animate-sos-wave rounded-full bg-[rgba(255,106,77,.35)] motion-reduce:animate-none motion-reduce:opacity-50" />
              <span className="absolute inset-0 animate-sos-wave rounded-full bg-[rgba(255,106,77,.35)] [animation-delay:.85s] motion-reduce:animate-none motion-reduce:opacity-50" />
              <span className="relative grid size-18 place-items-center rounded-full bg-brand shadow-[0_0_0_5px_rgba(255,255,255,.12)]">
                <Siren className="size-8" strokeWidth={2.2} />
              </span>
            </span>

            <div>
              <p className="text-sm font-semibold text-white/70">Có người cần trợ giúp</p>
              <h1 id="incoming-call-title" className="mt-0.5 text-[clamp(30px,5svh,40px)] leading-tight font-black">
                {offer.situation ?? "Người cần trợ giúp"}
              </h1>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-sm font-semibold text-white/90">
              <span className="inline-flex items-center gap-1.5">
                <MapPin aria-hidden="true" className="size-4" /> {where}
              </span>
              {offer.photoCount > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <ImageIcon aria-hidden="true" className="size-4" /> {offer.photoCount} ảnh
                </span>
              )}
              {offer.hasVideo && (
                <span className="inline-flex items-center gap-1.5">
                  <Video aria-hidden="true" className="size-4" /> 1 video
                </span>
              )}
            </div>

            {secondsLeft !== null && (
              <p className="text-sm text-white/70" role="timer">
                {secondsLeft > 0 ? (
                  <>Còn <strong className="text-base text-white tabular-nums">{formatClock(secondsLeft)}</strong> để nhận yêu cầu</>
                ) : (
                  "Yêu cầu sắp hết hạn"
                )}
              </p>
            )}
            {others > 0 && <p className="text-xs font-semibold text-white/60">+{others} yêu cầu khác đang chờ</p>}
          </div>

          <div className="grid gap-3.5">
            {offer.description && (
              <blockquote className="border-l-2 border-white/30 pl-4 text-left text-[15px] leading-snug text-white/95">
                <span className="mb-1 block text-xs font-bold tracking-wide text-white/60 uppercase">Mô tả từ người cần giúp</span>
                {offer.description}
              </blockquote>
            )}

            {shown.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-bold tracking-wide text-white/60 uppercase">Ảnh hiện trường</p>
                <ul className="grid grid-cols-3 gap-2.5">
                  {shown.map((url, index) => (
                    <li key={url} className="aspect-square overflow-hidden rounded-xl bg-white/10">
                      <button
                        type="button"
                        onClick={() => setEnlarged(url)}
                        aria-label={`Xem ảnh hiện trường ${index + 1}`}
                        className="size-full cursor-zoom-in focus-visible:ring-4 focus-visible:ring-white/60 focus-visible:outline-none"
                      >
                        <img src={url} alt={`Ảnh hiện trường ${index + 1}`} onError={() => setFailed((current) => [...current, url])} className="size-full object-cover" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {photosHidden && <p className="text-sm text-white/75">Chưa tải được ảnh hiện trường. Ảnh sẽ hiện sau khi bạn nhận hỗ trợ.</p>}

            {video && !videoFailed && (
              <div>
                <p className="mb-2 text-xs font-bold tracking-wide text-white/60 uppercase">Video hiện trường</p>
                <video src={video} controls playsInline preload="metadata" onError={() => setVideoFailed(true)} className="max-h-56 w-full rounded-xl bg-black/40" />
              </div>
            )}
          </div>
        </div>

        {error && (
          <p className="mx-auto mt-6 max-w-md text-center text-sm font-semibold text-[#ffb4a6]" role="alert">
            {error}
          </p>
        )}

        <div className="mx-auto mt-8 flex w-full max-w-md items-start justify-around">
          <button
            type="button"
            onClick={onDecline}
            className="group flex cursor-pointer flex-col items-center gap-2 text-sm font-bold focus-visible:outline-none"
          >
            <span className="grid size-16 place-items-center rounded-full border-2 border-white/40 transition-colors group-hover:bg-white/15 group-focus-visible:ring-4 group-focus-visible:ring-white/40">
              <X aria-hidden="true" className="size-7" />
            </span>
            Bỏ qua
          </button>
          <button
            ref={acceptButton}
            type="button"
            onClick={onAccept}
            className="group flex cursor-pointer flex-col items-center gap-2 text-sm font-black focus-visible:outline-none"
          >
            <span className="grid size-16 place-items-center rounded-full bg-[#1e9e4a] transition-colors group-hover:bg-[#23b254] group-focus-visible:ring-4 group-focus-visible:ring-white/60">
              <HandHeart aria-hidden="true" className="size-7" />
            </span>
            Nhận hỗ trợ
          </button>
        </div>
      </div>

      {enlarged && (
        <div className="fixed inset-0 z-[110] grid place-items-center bg-black/85 p-4" role="dialog" aria-modal="true" aria-label="Ảnh hiện trường" onClick={() => setEnlarged(null)}>
          <img src={enlarged} alt="Ảnh hiện trường phóng to" className="max-h-full max-w-full rounded-xl object-contain" />
          <button type="button" onClick={() => setEnlarged(null)} aria-label="Đóng ảnh" className="absolute top-4 right-4 grid size-11 cursor-pointer place-items-center rounded-full bg-white/15 text-white hover:bg-white/25">
            <X aria-hidden="true" className="size-6" />
          </button>
        </div>
      )}
    </div>
  );
}
