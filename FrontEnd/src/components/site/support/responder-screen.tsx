"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { Bike, BookOpenCheck, Car, CheckCircle2, HandHeart, ImageIcon, MapPin, PartyPopper, Phone, Power, Volume2, X } from "lucide-react";
import CourseLearning from "@/components/site/courses/course-learning";
import { CompletedCourseChips } from "@/components/site/courses/completed-courses";
import Navbar from "@/components/site/landing/Navbar";
import { Page } from "@/components/site/primitives";
import IncomingCallOverlay from "@/components/site/support/incoming-call-overlay";
import { previewScenePhotos } from "@/components/site/support/incoming-call-preview-photos";
import PointMap from "@/components/site/support/point-map";
import SupporterOnboarding, { SupporterIntroSignedOut } from "@/components/site/support/supporter-onboarding";
import { Button } from "@/components/ui/button";
import { appNav, courseCopy, onboardingCopy, supportCopy } from "@/content/app";
import { formatDistance, formatPhone } from "@/content/facilities";
import { useAuthFetch, useSession } from "@/hooks/use-auth";
import { useSupporterProfile } from "@/hooks/use-supporter";
import { DEMO_LOCATION_ENABLED, useLivePosition } from "@/hooks/useLivePosition";
import { useSupportChannel, type ChannelStatus } from "@/hooks/useSupportChannel";
import { formatDuration, useDirections, type Vehicle } from "@/lib/directions";
import { notifyInBackground, ring, unlockAlarm } from "@/lib/support/alarm";
import { DEMO_SUPPORTER_OFFSET_METERS, offsetNorth } from "@/lib/support/demo-offset";
import { distanceBeforeAccepting, photoUrl, videoSource, type ResponderRequest } from "@/lib/support/protocol";
import { cn } from "@/lib/utils";

const LOGIN_NEXT = "/dang-nhap?next=%2Fapp%2Fsan-sang-ho-tro";
const KEEPALIVE_MS = 60_000; // presence lives 5 min on the server

const RING_EVERY_MS = 4000; // the bell repeats until the request is accepted, declined or gone

const rounded = (value: number | undefined, digits: number) => (value === undefined ? "" : value.toFixed(digits));

// Người hỗ trợ (đã xác minh): bật "Sẵn sàng" mà không cần GPS. Yêu cầu tới qua Supabase Realtime như một cuộc gọi đến
// (chuông, màn hình toàn trang với khu vực, mô tả, ảnh, video). GPS chỉ bắt đầu sau khi nhận yêu cầu; phiên hỗ trợ
// hiển thị vị trí chính xác, số điện thoại, ảnh, video và dẫn đường; xong bấm Hoàn thành.
export default function ResponderScreen() {
  const c = supportCopy.responder;
  const { user, status: sessionStatus } = useSession();
  const authFetch = useAuthFetch();
  const profile = useSupporterProfile();
  // Only a verified supporter gets the supporter mode; everyone else sees the way there (SupporterOnboarding).
  const enrolled = profile.data?.status === "verified";

  const [wantAvailable, setWantAvailable] = useState(false);
  const [available, setAvailable] = useState(false);
  const [offers, setOffers] = useState<ResponderRequest[]>([]);
  const [active, setActive] = useState<ResponderRequest | null>(null);
  const [notice, setNotice] = useState("");
  const [reviewing, setReviewing] = useState(false);

  // Approved since the last visit: say "Đăng ký thành công" for this visit, and tell the server it was seen so it is
  // not said again (on any device).
  const [welcome, setWelcome] = useState(false);
  const welcomed = useRef(false);
  const justVerified = profile.data?.justVerified === true;
  useEffect(() => {
    if (!justVerified || welcomed.current) return;
    welcomed.current = true;
    queueMicrotask(() => setWelcome(true));
    void authFetch("/api/support/me/welcome", { method: "POST" });
  }, [justVerified, authFetch]);
  // GPS runs while ready (requests go to the nearest supporters first, and show them the distance) and while helping
  // (it moves us on the requester's map). Switching "Sẵn sàng" on is the consent; off stops it and the server drops it.
  const { position: gpsPosition, status: positionStatus } = useLivePosition(wantAvailable || active !== null, false);
  // Demo (requester and supporter on one computer): stand 1 km north of the GPS reading, or of the requester when this
  // browser has no fix, so the map always has a route to show.
  const requesterLat = active?.latitude;
  const requesterLng = active?.longitude;
  const position = useMemo(() => {
    if (!DEMO_LOCATION_ENABLED) return gpsPosition;
    const requester = requesterLat != null && requesterLng != null ? { lat: requesterLat, lng: requesterLng } : null;
    return offsetNorth(gpsPosition ?? requester, DEMO_SUPPORTER_OFFSET_METERS);
  }, [gpsPosition, requesterLat, requesterLng]);

  // Readiness survives a reload: start from what the server says.
  const readinessLoaded = useRef(false);
  useEffect(() => {
    if (profile.data?.status === "verified" && !readinessLoaded.current) {
      readinessLoaded.current = true;
      if (profile.data.available) queueMicrotask(() => setWantAvailable(true));
    }
  }, [profile.data]);

  const removeOffer = (id: string) => setOffers((current) => current.filter((offer) => offer.id !== id));
  const showList = useCallback((requests: ResponderRequest[]) => {
    setActive(requests.find((r) => r.status === "ACCEPTED") ?? null);
    setOffers(requests.filter((r) => r.status === "OPEN"));
  }, []);

  // Requests come over HTTP; a Supabase Realtime signal (or a timer) only says "fetch again".
  const seen = useRef(new Set<string>());
  const refresh = useCallback(async () => {
    const response = await authFetch("/api/support/me/requests");
    if (!response.ok) return;
    const requests = (await response.json()) as ResponderRequest[];
    for (const request of requests) {
      if (request.status === "OPEN" && !seen.current.has(request.id)) {
        const distance = distanceBeforeAccepting(request);
        notifyInBackground(c.alertTitle, distance ? `${request.situation ?? c.someone} · ${distance}` : (request.situation ?? c.someone));
      }
    }
    seen.current = new Set(requests.map((request) => request.id));
    showList(requests);
  }, [authFetch, showList, c.alertTitle, c.someone]);

  const { status: socketStatus } = useSupportChannel({
    enabled: enrolled,
    topic: user ? `support:responder:${user.id}` : null,
    refresh,
    onSignal: (type) => {
      if (type === "request.taken") setNotice(c.taken);
      else if (type === "request.cancelled") setNotice(c.cancelled);
      else if (type === "request.expired") setNotice(c.expired);
    },
  });

  // Tell the server: `available` while waiting (with the position when we have one; also refreshes presence),
  // `location` while helping (moves us on the requester's map), `unavailable` when switched off. While waiting the
  // position is rounded to ~100 m, so GPS jitter does not send an update every few seconds.
  const activeId = active?.id;
  const lat = rounded(position?.lat, activeId ? 4 : 3);
  const lng = rounded(position?.lng, activeId ? 4 : 3);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!wantAvailable && !activeId) return;
    const timer = setInterval(() => setTick((value) => value + 1), KEEPALIVE_MS);
    return () => clearInterval(timer);
  }, [wantAvailable, activeId]);

  const lastSent = useRef("");
  useEffect(() => {
    if (!enrolled) return;
    const point = lat && lng ? { latitude: Number(lat), longitude: Number(lng) } : null;
    if (activeId && point) {
      void authFetch("/api/support/me/location", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(point) });
    } else if (wantAvailable) {
      void authFetch("/api/support/me/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(point ? { available: true, ...point, consentToLocationUse: true } : { available: true }),
      }).then((r) => r.ok && setAvailable(true));
    } else if (lastSent.current === "available") {
      void authFetch("/api/support/me/availability", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ available: false }) });
      setAvailable(false);
    }
    lastSent.current = wantAvailable ? "available" : activeId ? "location" : "off";
  }, [enrolled, wantAvailable, activeId, lat, lng, tick, authFetch]);

  const toggle = async () => {
    // Must run synchronously inside the tap: phones only let a page play sound after a user gesture
    if (!wantAvailable) unlockAlarm();
    setWantAvailable((value) => !value);
    setNotice("");
    if (!wantAvailable && "Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission().catch(() => undefined);
    }
  };

  // The bell rings right away for a new request and repeats every few seconds until it is accepted, declined or gone
  const ringing = offers.length > 0 && active === null;
  const newest = offers[0]?.id;
  useEffect(() => {
    if (!ringing) return;
    ring();
    const timer = setInterval(ring, RING_EVERY_MS);
    return () => clearInterval(timer);
  }, [ringing, newest]);

  const accept = async (offer: ResponderRequest) => {
    setNotice("");
    const response = await authFetch(`/api/support/me/requests/${offer.id}/accept`, { method: "POST" });
    if (response.ok) {
      removeOffer(offer.id);
      setActive((await response.json()) as ResponderRequest);
    } else {
      removeOffer(offer.id);
      setNotice(c.taken);
    }
  };

  const decline = (offer: ResponderRequest) => {
    removeOffer(offer.id);
    void authFetch(`/api/support/me/requests/${offer.id}/decline`, { method: "POST" });
  };

  const complete = async () => {
    if (!active) return;
    await authFetch(`/api/support/me/requests/${active.id}/complete`, { method: "POST" });
    setActive(null);
    setNotice(c.completed);
  };

  // The ringing offer's video: a short-lived Storage link (or the backend stream in local dev).
  const ringingOffer = ringing ? offers[0] : null;
  // The fetcher takes the id from the SWR key: a `ringingOffer!` here lets the React Compiler read
  // ringingOffer.hasVideo without the null check, which crashed the page whenever nothing was ringing.
  const ringingVideo = useSWR(ringingOffer?.hasVideo ? ["support-video", ringingOffer.id] : null, ([, id]: [string, string]) =>
    videoSource(authFetch, id),
  );

  // Design preview of the incoming-call screen: /app/san-sang-ho-tro?preview=call (no real request is involved).
  const [previewOffer, setPreviewOffer] = useState<ResponderRequest | null>(null);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("preview") !== "call") return;
    queueMicrotask(() =>
      setPreviewOffer({
        id: "preview",
        status: "OPEN",
        situation: "Bất tỉnh",
        description: "Người lớn tuổi ngã trước cửa hàng, không trả lời khi gọi, đang thở yếu. Cần người biết hồi sức tim phổi.",
        expiresAt: new Date(Date.now() + 2 * 60_000).toISOString(),
        photoCount: 2,
        approximateDistanceMeters: 1200,
      }),
    );
  }, []);
  const closePreview = () => {
    setPreviewOffer(null);
    setNotice(c.previewClosed);
  };

  return (
    <Page>
      <Navbar appLinks={appNav} />
      <main className="mx-auto w-full max-w-180 px-4 pt-7 pb-12">
        <h1 className="text-[clamp(26px,3.4vw,36px)] leading-[1.15] font-black text-ink">{enrolled ? c.title : onboardingCopy.title}</h1>

        {sessionStatus === "unauthenticated" && <SupporterIntroSignedOut loginHref={LOGIN_NEXT} />}

        {enrolled && welcome && (
          <section className="mt-6 flex items-start gap-3 rounded-2xl border-2 border-[#1e9e4a] bg-[#f1fbf4] p-5" role="status">
            <PartyPopper aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-[#1e7d3a]" />
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-black text-[#145c2a]">{c.welcomeTitle}</h2>
              <p className="mt-1 text-[15px] leading-[1.55] text-ink">{c.welcomeBody}</p>
            </div>
            <button type="button" onClick={() => setWelcome(false)} aria-label={c.dismiss} className="cursor-pointer text-muted-foreground"><X className="size-4" /></button>
          </section>
        )}

        {user && profile.isLoading && <p className="mt-6 text-sm text-muted-foreground">{c.loading}</p>}

        {user && profile.error && (
          <section className="mt-6 rounded-2xl border border-line bg-white p-5">
            <p className="text-[15px] text-ink">{c.loadFailed}</p>
            <Button variant="outline" onClick={() => void profile.mutate()} className="mt-4 rounded-full">{c.retry}</Button>
          </section>
        )}

        {user && profile.data && !enrolled && (
          <SupporterOnboarding
            profile={profile.data}
            defaultName={user.displayName ?? ""}
            onChanged={(next) => void profile.mutate(next, { revalidate: false })}
          />
        )}

        {enrolled && (
          <>
            <section className="mt-6 rounded-2xl border border-line bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">{profile.data?.displayName} · {formatPhone(profile.data?.contactPhone ?? "")}</p>
                  <p className={cn("mt-1 text-lg font-bold", available ? "text-[#1e7d3a]" : "text-ink")}>{available ? c.on : wantAvailable ? c.turningOn : c.off}</p>
                </div>
                <Button onClick={toggle} variant={wantAvailable ? "outline" : "default"} className="h-11 rounded-full px-5 font-bold [&_svg]:size-4.5">
                  <Power aria-hidden="true" /> {wantAvailable ? c.turnOff : c.turnOn}
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ConnectionChip status={socketStatus} />
                <button
                  type="button"
                  onClick={() => setReviewing((current) => !current)}
                  aria-expanded={reviewing}
                  className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1 text-xs font-semibold text-ink hover:border-brand hover:text-brand [&_svg]:size-3.5"
                >
                  <BookOpenCheck aria-hidden="true" /> {c.courseLink}
                </button>
                <button
                  type="button"
                  onClick={() => { unlockAlarm(); ring(); }}
                  className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1 text-xs font-semibold text-ink hover:border-brand hover:text-brand [&_svg]:size-3.5"
                >
                  <Volume2 aria-hidden="true" /> {c.testSound}
                </button>
              </div>
              <CompletedCourseChips courses={profile.data?.completedCourses ?? []} label={courseCopy.earned} className="mt-2.5" />
              <p className="mt-3 text-sm leading-snug text-muted-foreground">{c.locationPrivacy}</p>
              {active && positionStatus === "denied" && <p className="mt-2 text-sm text-brand">{c.locationDenied}</p>}
              {!active && wantAvailable && positionStatus === "denied" && <p className="mt-2 text-sm text-brand">{c.locationDeniedWaiting}</p>}
            </section>

            {/* The courses are reviewed here (there is no public course page) */}
            {reviewing && (
              <section className="mt-6 rounded-2xl border border-line bg-white p-5" aria-label={c.courseLink}>
                <CourseLearning />
              </section>
            )}

            {notice && (
              <p className="mt-4 flex items-center justify-between gap-2 rounded-xl bg-[#f4f4f5] px-4 py-2.5 text-sm text-ink" role="status">
                {notice}
                <button type="button" onClick={() => setNotice("")} aria-label={c.dismiss} className="cursor-pointer text-muted-foreground"><X className="size-4" /></button>
              </p>
            )}

            {active ? (
              <ActiveRequest request={active} me={position} onComplete={complete} />
            ) : (
              <section className="mt-6" aria-live="assertive">
                <h2 className="text-lg font-bold text-ink">{c.incoming}</h2>
                {offers.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">{available ? c.waiting : c.offHint}</p>
                ) : (
                  <ul className="mt-3 grid gap-3">
                    {offers.map((offer) => (
                      <li key={offer.id} className="animate-step-rise rounded-2xl border-2 border-brand bg-white p-4.5 shadow-[0_10px_30px_rgba(218,54,26,.15)]">
                        <p className="text-xs font-bold tracking-wide text-brand uppercase">{c.alertTitle}</p>
                        <h3 className="mt-1 text-xl font-black text-ink">{offer.situation ?? c.someone}</h3>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" /> {distanceBeforeAccepting(offer) ?? c.placeAfterAccepting}</span>
                          {offer.photoCount > 0 && <span className="inline-flex items-center gap-1"><ImageIcon className="size-3.5" /> {c.photoCount(offer.photoCount)}</span>}
                        </p>
                        {offer.description && <p className="mt-2 text-[15px] leading-snug text-ink">{offer.description}</p>}
                        <div className="mt-3.5 grid grid-cols-2 gap-2.5">
                          <Button variant="outline" onClick={() => decline(offer)} className="h-11 rounded-full">{c.decline}</Button>
                          <Button onClick={() => void accept(offer)} className="h-11 rounded-full font-bold [&_svg]:size-4.5"><HandHeart aria-hidden="true" /> {c.accept}</Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </>
        )}
      </main>
      {previewOffer ? (
        <IncomingCallOverlay offer={previewOffer} photos={previewScenePhotos} onAccept={closePreview} onDecline={closePreview} />
      ) : (
        ringingOffer && (
          <IncomingCallOverlay
            offer={ringingOffer}
            photos={Array.from({ length: ringingOffer.photoCount }, (_, index) => photoUrl(ringingOffer.id, index))}
            video={ringingVideo.data ?? undefined}
            others={offers.length - 1}
            error={notice}
            onAccept={() => void accept(ringingOffer)}
            onDecline={() => decline(ringingOffer)}
          />
        )
      )}
    </Page>
  );
}

function ConnectionChip({ status }: { status: ChannelStatus }) {
  const c = supportCopy.responder.connection;
  const [label, dot] =
    status === "open" ? [c.open, "bg-[#1e9e4a]"] : status === "polling" ? [c.polling, "bg-[#9aa0a6]"] : [c.connecting, "bg-[#e3a008]"];
  return (
    <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#f4f4f5] px-2.5 py-1 text-xs text-muted-foreground">
      <span className={cn("size-2 rounded-full", dot)} aria-hidden="true" /> {label}
    </p>
  );
}

const vehicles: { id: Vehicle; label: string; icon: typeof Car }[] = [
  { id: "motorbike", label: "Xe máy", icon: Bike },
  { id: "car", label: "Ô tô", icon: Car },
];

function ActiveRequest({ request, me, onComplete }: { request: ResponderRequest; me: { lat: number; lng: number } | null; onComplete: () => void }) {
  const c = supportCopy.responder;
  const [vehicle, setVehicle] = useState<Vehicle>("motorbike");
  const [activeRoute, setActiveRoute] = useState(0);
  const target = request.latitude != null && request.longitude != null ? { lat: request.latitude, lng: request.longitude } : null;
  // Route from where we were when the request was accepted (re-routing on every GPS step would spend Mapbox calls)
  const [origin] = useState(me);
  const directions = useDirections(origin ?? me, target, vehicle);
  const routes = directions.data ?? [];
  const route = routes[Math.min(activeRoute, Math.max(0, routes.length - 1))];
  const authFetch = useAuthFetch();
  // Signed links last 5 minutes: fetch a fresh one when the video arrives, not on every refresh of the request.
  const video = useSWR(request.hasVideo ? ["support-video", request.id] : null, () => videoSource(authFetch, request.id), {
    revalidateOnFocus: false,
  });
  return (
    <section className="mt-6 grid gap-4" aria-live="polite">
      <div className="rounded-2xl border-2 border-[#1a73e8] bg-white p-4.5">
        <p className="text-xs font-bold tracking-wide text-[#1a73e8] uppercase">{c.helping}</p>
        <h2 className="mt-1 text-2xl font-black text-ink">{request.situation ?? c.someone}</h2>
        {request.description && <p className="mt-1.5 text-[15px] leading-snug text-ink">{request.description}</p>}
        <div className="mt-3.5 flex flex-wrap gap-2.5">
          {request.contactPhone && (
            <Button asChild className="rounded-full font-bold [&_svg]:size-4">
              <a href={`tel:${request.contactPhone}`}><Phone aria-hidden="true" /> {c.call} {formatPhone(request.contactPhone)}</a>
            </Button>
          )}
          <Button variant="outline" onClick={onComplete} className="rounded-full font-semibold [&_svg]:size-4"><CheckCircle2 aria-hidden="true" /> {c.complete}</Button>
        </div>
        {request.photoCount > 0 && (
          <div className="mt-4 flex flex-wrap gap-2.5">
            {Array.from({ length: request.photoCount }, (_, index) => (
              <a key={index} href={photoUrl(request.id, index)} target="_blank" rel="noreferrer" className="block size-24 overflow-hidden rounded-xl border border-line">
                <img src={photoUrl(request.id, index)} alt={`${c.photo} ${index + 1}`} className="size-full object-cover" />
              </a>
            ))}
          </div>
        )}
        {video.data && <video src={video.data} controls playsInline preload="metadata" className="mt-4 max-h-64 w-full rounded-xl bg-black/5" />}
      </div>

      <div className="rounded-2xl border border-[#d2e3fc] bg-[#f6f9fe] p-3">
        <div className="inline-flex rounded-full bg-white p-0.5 shadow-[inset_0_0_0_1px_#d2e3fc]" role="group" aria-label="Phương tiện">
          {vehicles.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={vehicle === id}
              onClick={() => { setVehicle(id); setActiveRoute(0); }}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold text-[#3c4043] aria-pressed:bg-[#1a73e8] aria-pressed:text-white [&_svg]:size-4"
            >
              <Icon aria-hidden="true" /> {label}
            </button>
          ))}
        </div>
        {!me && <p className="mt-2 text-sm text-muted-foreground">{c.locating}</p>}
        {directions.isLoading && <p className="mt-2 text-sm text-muted-foreground">Đang tìm đường đi…</p>}
        {directions.error && <p className="mt-2 text-sm text-[#942025]">{directions.error.message}</p>}
        {route && (
          <p className="mt-2.5 text-[15px] text-ink">
            <strong className="text-lg text-[#1a73e8]">{formatDuration(route.duration)}</strong> · {formatDistance(route.distance)}
            {routes.length > 1 && <span className="text-sm text-muted-foreground"> · {c.routesHint}</span>}
          </p>
        )}
      </div>
      <PointMap me={me} other={target} label={c.requesterPin} routes={routes} activeRoute={activeRoute} onSelectRoute={setActiveRoute} />
    </section>
  );
}
