"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Camera, HandHeart, Loader2, MapPin, Phone, X } from "lucide-react";
import { CompletedCourseChips } from "@/components/site/courses/completed-courses";
import Navbar from "@/components/site/landing/Navbar";
import { Page } from "@/components/site/primitives";
import DemoPlacePicker from "@/components/site/support/demo-place-picker";
import PointMap from "@/components/site/support/point-map";
import { Button } from "@/components/ui/button";
import { appNav, courseCopy, supportCopy } from "@/content/app";
import { formatDistance, formatPhone } from "@/content/facilities";
import { useLivePosition } from "@/hooks/useLivePosition";
import { useSupportSocket } from "@/hooks/useSupportSocket";
import {
  SITUATIONS,
  cancelSupportRequest,
  compressPhoto,
  createSupportRequest,
  fetchRequesterState,
  uploadSupportPhoto,
  type CreatedRequest,
  type RequesterMessage,
  type RequesterState,
} from "@/lib/support/protocol";
import { cn } from "@/lib/utils";

type Phase = "form" | "sending" | "searching" | "accepted" | "ended" | "none";
type Ended = "completed" | "cancelled" | "expired";

const sosRing = "absolute inset-[14%] animate-sos-wave rounded-full bg-[rgba(234,84,85,.14)] motion-reduce:animate-none motion-reduce:opacity-50";
const STORAGE_KEY = "sos-support-request";
const NO_ONE_HINT_MS = 2 * 60_000;
const MAX_PHOTOS = 3;

function loadSaved(): CreatedRequest | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CreatedRequest) : null;
  } catch {
    return null;
  }
}

function save(request: CreatedRequest | null) {
  try {
    if (request) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(request));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage blocked: the request still works on this page, it just is not resumed after a reload
  }
}

// Người cần giúp: gửi tín hiệu (số điện thoại, tình huống, mô tả, ảnh, vị trí) tới người hỗ trợ trong bán kính 3 km,
// rồi theo dõi qua WebSocket: số người đã được báo, ai đã nhận, vị trí người đó đang tới. Không cần tài khoản.
export default function RequesterScreen() {
  const c = supportCopy.requester;
  const { position, status: positionStatus, demoPlace, setDemoPlace } = useLivePosition(true);
  const [phase, setPhase] = useState<Phase>("form");
  const [request, setRequest] = useState<CreatedRequest | null>(null);
  const [info, setInfo] = useState<RequesterState | null>(null);
  const [ended, setEnded] = useState<Ended>("completed");
  const [noOneYet, setNoOneYet] = useState(false);
  const [formError, setFormError] = useState("");

  const [phone, setPhone] = useState("");
  const [situation, setSituation] = useState<string>(SITUATIONS[0]);
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<{ file: File; url: string }[]>([]);
  const [consent, setConsent] = useState(false);

  // Resume a request after a reload of this tab
  useEffect(() => {
    const saved = loadSaved();
    if (saved) {
      queueMicrotask(() => {
        setRequest(saved);
        setPhase("searching");
      });
    }
  }, []);

  const finish = (reason: Ended) => {
    save(null);
    setEnded(reason);
    setPhase("ended");
  };

  const apply = (state: RequesterState) => {
    setInfo(state);
    if (state.status === "ACCEPTED") setPhase("accepted");
    else if (state.status === "COMPLETED") finish("completed");
    else if (state.status === "CANCELLED") finish("cancelled");
  };

  const live = phase === "searching" || phase === "accepted";
  const { status: socketStatus, send } = useSupportSocket<RequesterMessage>({
    enabled: live && request !== null,
    hello: async () => (request ? { type: "hello", role: "requester", requestId: request.id, token: request.requesterToken } : null),
    onMessage: (message) => {
      switch (message.type) {
        case "request.state":
        case "request.accepted":
          return apply(message.request);
        case "request.invited":
          return setInfo((current) => (current ? { ...current, invitedCount: message.invitedCount } : current));
        case "responder.location":
          return setInfo((current) =>
            current?.responder
              ? { ...current, responder: { ...current.responder, latitude: message.latitude, longitude: message.longitude, distanceMeters: message.distanceMeters } }
              : current,
          );
        case "request.completed":
          return finish("completed");
        case "request.cancelled":
          return finish("cancelled");
        case "request.expired":
          return finish("expired");
      }
    },
    poll: async () => {
      if (!request) return;
      const state = await fetchRequesterState(request);
      if (state) apply(state);
      else finish("expired");
    },
    onRejected: () => finish("expired"),
  });

  // After 2 minutes without anyone accepting, suggest 115 and the nearest facilities (the request stays open).
  useEffect(() => {
    if (phase !== "searching") return;
    const timer = setTimeout(() => setNoOneYet(true), NO_ONE_HINT_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  const addPhotos = (files: FileList | null) => {
    if (!files) return;
    const room = MAX_PHOTOS - photos.length;
    const picked = Array.from(files).filter((file) => file.type.startsWith("image/")).slice(0, room);
    setPhotos((current) => [...current, ...picked.map((file) => ({ file, url: URL.createObjectURL(file) }))]);
  };

  const removePhoto = (index: number) =>
    setPhotos((current) => {
      URL.revokeObjectURL(current[index].url);
      return current.filter((_, i) => i !== index);
    });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError("");
    if (!position) return setFormError(c.needLocation);
    if (!/^\+?[0-9]{8,15}$/.test(phone.replace(/[\s.-]/g, ""))) return setFormError(c.badPhone);
    if (!consent) return setFormError(c.needConsent);
    setPhase("sending");
    const result = await createSupportRequest({
      latitude: position.lat,
      longitude: position.lng,
      contactPhone: phone,
      situation,
      description: description.trim(),
    }).catch(() => null);
    if (!result) {
      setPhase("form");
      return setFormError(c.network);
    }
    if (!result.ok) {
      if (result.status === 409) return setPhase("none");
      setPhase("form");
      return setFormError(result.status === 400 ? c.badInput : c.network);
    }
    const created = result.request;
    save(created);
    setRequest(created);
    setInfo({ id: created.id, status: "OPEN", expiresAt: created.expiresAt, invitedCount: created.invitedCount, photoCount: 0 });
    setNoOneYet(false);
    setPhase("searching");
    for (const photo of photos) {
      const blob = await compressPhoto(photo.file).catch(() => photo.file);
      await uploadSupportPhoto(created, blob).catch(() => false);
    }
  };

  const cancel = async () => {
    if (!request) return;
    if (!send({ type: "cancel" })) await cancelSupportRequest(request);
    finish("cancelled");
  };

  const restart = () => {
    setRequest(null);
    setInfo(null);
    setNoOneYet(false);
    setPhase("form");
  };

  const responder = info?.responder;
  const responderPoint = responder?.latitude !== undefined && responder.longitude !== undefined ? { lat: responder.latitude, lng: responder.longitude } : null;

  return (
    <Page>
      <Navbar appLinks={appNav} />
      <main className="mx-auto w-full max-w-180 px-4 pt-7 pb-12">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[clamp(26px,3.4vw,36px)] leading-[1.15] font-black text-ink">{c.title}</h1>
            <p className="mt-2 max-w-130 text-[15px] leading-[1.55] text-muted-foreground">{c.subtitle}</p>
          </div>
          <Button asChild className="h-auto rounded-full px-5 py-2.5 text-base font-bold shadow-[0_10px_24px_rgba(218,54,26,.3)] hover:bg-brand-dark [&_svg]:size-4.5">
            <a href="tel:115"><Phone aria-hidden="true" /> Gọi 115</a>
          </Button>
        </div>

        {(phase === "form" || phase === "sending") && (
          <form onSubmit={submit} className="mt-6 grid gap-5 rounded-2xl border border-line bg-white p-5" noValidate>
            <p className={cn("flex items-center gap-1.5 text-sm", position ? "text-[#1e7d3a]" : "text-muted-foreground", positionStatus === "denied" && "text-brand")}>
              <MapPin aria-hidden="true" className="size-4" />
              {position ? c.located : positionStatus === "denied" ? c.locationDenied : c.locating}
            </p>
            <DemoPlacePicker value={demoPlace} onChange={setDemoPlace} />

            <label className="grid gap-1.5">
              <span className="text-sm font-bold text-ink">{c.phone} <span className="text-brand">*</span></span>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="0901 234 567"
                className="h-11 rounded-xl border border-line px-3.5 text-base outline-none focus:border-brand"
              />
              <span className="text-xs text-muted-foreground">{c.phoneHint}</span>
            </label>

            <fieldset className="grid gap-2">
              <legend className="mb-1.5 text-sm font-bold text-ink">{c.situation}</legend>
              <div className="flex flex-wrap gap-2">
                {SITUATIONS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={situation === item}
                    onClick={() => setSituation(item)}
                    className="cursor-pointer rounded-full border border-line bg-white px-3.5 py-1.5 text-sm font-semibold text-ink aria-pressed:border-brand aria-pressed:bg-brand-soft aria-pressed:text-brand"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="grid gap-1.5">
              <span className="text-sm font-bold text-ink">{c.description}</span>
              <textarea
                value={description}
                maxLength={500}
                rows={3}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={c.descriptionPlaceholder}
                className="rounded-xl border border-line px-3.5 py-2.5 text-base outline-none focus:border-brand"
              />
            </label>

            <div className="grid gap-2">
              <span className="text-sm font-bold text-ink">{c.photos} <span className="font-normal text-muted-foreground">({photos.length}/{MAX_PHOTOS})</span></span>
              <div className="flex flex-wrap gap-2.5">
                {photos.map((photo, index) => (
                  <div key={photo.url} className="relative size-20 overflow-hidden rounded-xl border border-line">
                    <img src={photo.url} alt={`${c.photo} ${index + 1}`} className="size-full object-cover" />
                    <button type="button" onClick={() => removePhoto(index)} aria-label={`${c.removePhoto} ${index + 1}`} className="absolute top-1 right-1 grid size-6 cursor-pointer place-items-center rounded-full bg-black/60 text-white [&_svg]:size-3.5">
                      <X aria-hidden="true" />
                    </button>
                  </div>
                ))}
                {photos.length < MAX_PHOTOS && (
                  <label className="grid size-20 cursor-pointer place-items-center rounded-xl border border-dashed border-[#c9c9c9] text-muted-foreground hover:border-brand hover:text-brand">
                    <Camera aria-hidden="true" className="size-6" />
                    <input type="file" accept="image/*" capture="environment" multiple className="sr-only" onChange={(event) => { addPhotos(event.target.files); event.target.value = ""; }} />
                    <span className="sr-only">{c.addPhoto}</span>
                  </label>
                )}
              </div>
            </div>

            <label className="flex items-start gap-2.5 text-sm leading-snug text-ink">
              <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-0.5 size-4.5 accent-[#da361a]" />
              <span>{c.consent}</span>
            </label>

            {formError && <p className="text-sm font-semibold text-brand" role="alert">{formError}</p>}
            <Button type="submit" disabled={phase === "sending"} className="h-12 rounded-full text-base font-bold [&_svg]:size-5">
              {phase === "sending" ? <Loader2 aria-hidden="true" className="animate-spin" /> : <HandHeart aria-hidden="true" />} {c.send}
            </Button>
          </form>
        )}

        {phase === "searching" && (
          <section className="mt-6 flex flex-col items-center px-5 pt-2 pb-6 text-center" aria-live="polite">
            {/* Nút SOS với sóng lan như màn hình Nút SOS: đang phát tín hiệu */}
            <div className="relative my-[clamp(12px,3vh,28px)] grid aspect-square w-[min(300px,72vw)] place-items-center" aria-hidden="true">
              <span className={sosRing} />
              <span className={`${sosRing} [animation-delay:.85s]`} />
              <span className={`${sosRing} [animation-delay:1.7s]`} />
              <span className="relative grid aspect-square w-[62%] place-items-center rounded-full bg-[linear-gradient(160deg,#e5484d,#f07b7b)] text-[clamp(40px,7vw,56px)] leading-none font-black tracking-[.04em] text-white shadow-[0_18px_40px_rgba(229,72,77,.45),inset_0_-6px_0_rgba(0,0,0,.08)]">
                SOS
              </span>
            </div>
            <h2 className="text-xl font-bold text-ink">{c.searching}</h2>
            <p className="mt-1.5 text-[15px] text-muted-foreground">{info ? c.invited(info.invitedCount) : c.sendingSignal}</p>
            <p className="mt-1 text-xs text-muted-foreground/80">{socketStatus === "polling" ? c.polling : socketStatus === "open" ? c.live : c.connecting}</p>
            {noOneYet && (
              <div className="mt-4 max-w-115 rounded-xl border border-[#f5d0c8] bg-brand-soft p-3.5 text-left text-sm leading-snug text-ink">
                <p className="font-semibold">{c.noOneYet}</p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <a href="tel:115" className="rounded-full bg-brand px-3.5 py-1.5 font-bold text-white no-underline">Gọi 115</a>
                  <Link href="/app/co-so-y-te" className="rounded-full border border-line bg-white px-3.5 py-1.5 font-bold text-ink no-underline">{c.facilities}</Link>
                </div>
              </div>
            )}
            <Button variant="outline" onClick={cancel} className="mt-5 rounded-full">{c.cancel}</Button>
          </section>
        )}

        {phase === "accepted" && responder && (
          <section className="mt-6 grid gap-4" aria-live="polite">
            <div className="rounded-2xl border border-[#cdebd6] bg-[#f1fbf4] p-4.5">
              <p className="text-sm font-semibold text-[#1e7d3a]">{c.accepted}</p>
              <h2 className="mt-1 text-2xl font-black text-ink">{responder.displayName}</h2>
              <CompletedCourseChips courses={responder.completedCourses ?? []} label={courseCopy.responderCompleted} className="mt-1.5" />
              <p className="mt-1 text-[15px] text-muted-foreground">
                {responder.distanceMeters !== undefined ? c.distance(formatDistance(responder.distanceMeters)) : c.onTheWay}
              </p>
              <div className="mt-3.5 flex flex-wrap gap-2.5">
                <Button asChild className="rounded-full font-bold [&_svg]:size-4">
                  <a href={`tel:${responder.contactPhone}`}><Phone aria-hidden="true" /> {c.callResponder} {formatPhone(responder.contactPhone)}</a>
                </Button>
                <Button variant="outline" onClick={cancel} className="rounded-full">{c.cancel}</Button>
              </div>
            </div>
            <PointMap me={position} other={responderPoint} label={c.responderPin} />
          </section>
        )}

        {phase === "ended" && (
          <section className="mt-6 rounded-2xl border border-line bg-white p-6 text-center">
            <h2 className="text-xl font-bold text-ink">{c.ended[ended]}</h2>
            <Button onClick={restart} className="mt-4 rounded-full font-bold">{c.again}</Button>
          </section>
        )}

        {phase === "none" && (
          <section className="mt-6 rounded-2xl border border-line bg-white p-6 text-center">
            <h2 className="text-xl font-bold text-ink">{c.none}</h2>
            <p className="mt-2 text-[15px] text-muted-foreground">{c.noneHint}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2.5">
              <Button asChild className="rounded-full font-bold"><a href="tel:115">Gọi 115</a></Button>
              <Button asChild variant="outline" className="rounded-full"><Link href="/app/co-so-y-te">{c.facilities}</Link></Button>
              <Button variant="outline" onClick={() => setPhase("form")} className="rounded-full">{c.retry}</Button>
            </div>
          </section>
        )}

        <p className="mt-8 border-t border-line pt-4 text-sm text-muted-foreground">
          {c.helperPrompt} <Link href="/app/san-sang-ho-tro" className="font-bold text-brand">{c.helperLink}</Link>
        </p>
      </main>
    </Page>
  );
}
