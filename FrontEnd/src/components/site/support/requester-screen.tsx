"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { HandHeart, Loader2, MapPin, Phone } from "lucide-react";
import IncidentReportFields, { emptyReport, hasDescription, type IncidentReport } from "@/components/site/support/incident-report-fields";
import Navbar from "@/components/site/landing/Navbar";
import { Page } from "@/components/site/primitives";
import DemoNearbyRespondersMap from "@/components/site/support/demo-nearby-responders-map";
import PointMap from "@/components/site/support/point-map";
import { Button } from "@/components/ui/button";
import { appNav, supportCopy } from "@/content/app";
import { formatDistance, formatPhone } from "@/content/facilities";
import { useLivePosition } from "@/hooks/useLivePosition";
import type { Point } from "@/lib/api/hooks";
import { useSupportSocket } from "@/hooks/useSupportSocket";
import { nearestDistrict } from "@/lib/support/districts";
import {
  cancelSupportRequest,
  createSupportRequest,
  compressPhoto,
  fetchRequesterState,
  uploadSupportPhoto,
  uploadSupportVideo,
  type CreatedRequest,
  type RequesterMessage,
  type RequesterState,
} from "@/lib/support/protocol";
import { cn } from "@/lib/utils";

type Phase = "form" | "sending" | "searching" | "accepted" | "ended" | "none" | "demo";
type Ended = "completed" | "cancelled" | "expired";

const sosRing = "absolute inset-[14%] animate-sos-wave rounded-full bg-[rgba(234,84,85,.14)] motion-reduce:animate-none motion-reduce:opacity-50";
const STORAGE_KEY = "sos-support-request";
const NO_ONE_HINT_MS = 2 * 60_000;
const DEMO_CONTACT_PHONE = "0000000000";
const DEMO_RESPONDERS_ENABLED = process.env.NEXT_PUBLIC_DEMO_RESPONDERS === "true";

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

// Người cần giúp: gửi tín hiệu vị trí và số điện thoại tới người hỗ trợ đã đăng ký khu vực,
// rồi theo dõi qua WebSocket: ai đã nhận và vị trí người hỗ trợ đang tới. Không cần tài khoản.
export default function RequesterScreen() {
  const c = supportCopy.requester;
  const { position, status: positionStatus } = useLivePosition(true, false);
  const [phase, setPhase] = useState<Phase>("form");
  const [request, setRequest] = useState<CreatedRequest | null>(null);
  const [info, setInfo] = useState<RequesterState | null>(null);
  const [demoCenter, setDemoCenter] = useState<Point | null>(null);
  const [ended, setEnded] = useState<Ended>("completed");
  const [noOneYet, setNoOneYet] = useState(false);
  const [mediaNote, setMediaNote] = useState("");
  const [formError, setFormError] = useState("");

  // The callback number is sent automatically (no field); it becomes the verified Profile number later.
  const phone = DEMO_CONTACT_PHONE;
  const [report, setReport] = useState<IncidentReport>(emptyReport);

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

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError("");
    if (!position) return setFormError(c.needLocation);
    if (!/^\+?[0-9]{8,15}$/.test(phone.replace(/[\s.-]/g, ""))) return setFormError(c.badPhone);
    if (!hasDescription(report)) return setFormError("Hãy mô tả tình huống bằng chữ hoặc ghi âm.");
    if (DEMO_RESPONDERS_ENABLED) {
      setDemoCenter(position);
      setPhase("demo");
      return;
    }
    setPhase("sending");
    const result = await createSupportRequest({
      latitude: position.lat,
      longitude: position.lng,
      contactPhone: phone,
      // No area field: the supporters to notify are chosen from the requester's GPS position.
      area: nearestDistrict(position),
      description: report.text.trim() || undefined,
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
    // Photos and the video go up right after the request exists; invited supporters see them as soon as they arrive.
    // The voice note is only used for the typed description (speech to text) and stays on this device.
    let failedUploads = 0;
    for (const photo of report.photos) {
      const blob = await compressPhoto(photo.file).catch(() => photo.file);
      if (!(await uploadSupportPhoto(created, blob).catch(() => false))) failedUploads += 1;
    }
    if (report.video && !(await uploadSupportVideo(created, report.video.file).catch(() => false))) failedUploads += 1;
    setMediaNote(failedUploads > 0 ? `Chưa gửi được ${failedUploads} tệp ảnh/video. Yêu cầu vẫn được gửi; hãy mô tả bằng chữ hoặc gọi 115 nếu khẩn cấp.` : "");
    save(created);
    setRequest(created);
    setInfo({ id: created.id, status: "OPEN", expiresAt: created.expiresAt, invitedCount: created.invitedCount, photoCount: 0 });
    setNoOneYet(false);
    setPhase("searching");
  };

  const cancel = async () => {
    if (!request) return;
    if (!send({ type: "cancel" })) await cancelSupportRequest(request);
    finish("cancelled");
  };

  const restart = () => {
    setRequest(null);
    setInfo(null);
    setDemoCenter(null);
    setNoOneYet(false);
    setPhase("form");
  };

  const responder = info?.responder;
  const responderPoint = responder?.latitude !== undefined && responder.longitude !== undefined ? { lat: responder.latitude, lng: responder.longitude } : null;

  return (
    <Page>
      <Navbar appLinks={appNav} />
      <main className={cn("mx-auto w-full px-4 pt-7 pb-12", phase === "form" || phase === "sending" || phase === "demo" ? "max-w-none" : "max-w-180")}>
        <div>
          <h1 className="text-[clamp(26px,3.4vw,36px)] leading-[1.15] font-black text-ink">{c.title}</h1>
          <p className="mt-2 max-w-130 text-[15px] leading-[1.55] text-muted-foreground">{c.subtitle}</p>
        </div>

        {(phase === "form" || phase === "sending") && (
          <form onSubmit={submit} className="mt-6 grid gap-5 rounded-2xl border border-line bg-white p-5" noValidate>
            <p className={cn("flex items-center gap-1.5 text-sm", position ? "text-[#1e7d3a]" : "text-muted-foreground", positionStatus === "denied" && "text-brand")}>
              <MapPin aria-hidden="true" className="size-4" />
              {position ? c.located : positionStatus === "denied" ? c.locationDenied : c.locating}
            </p>
            <IncidentReportFields value={report} onChange={setReport} />

            {formError && <p className="text-sm font-semibold text-brand" role="alert">{formError}</p>}
            <Button type="submit" disabled={phase === "sending"} className="h-12 rounded-full text-base font-bold [&_svg]:size-5">
              {phase === "sending" ? <Loader2 aria-hidden="true" className="animate-spin" /> : <HandHeart aria-hidden="true" />} {DEMO_RESPONDERS_ENABLED ? c.demoStart : c.send}
            </Button>
          </form>
        )}

        {phase === "demo" && demoCenter && (
          <section className="mt-6 grid gap-4" aria-live="polite">
            <DemoNearbyRespondersMap center={demoCenter} />
          </section>
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
            {mediaNote && <p className="mt-2 max-w-115 text-sm font-semibold text-[#b3261e]" role="alert">{mediaNote}</p>}
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
      </main>
    </Page>
  );
}
