"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LocateFixed, MapPin, Phone, PhoneOff } from "lucide-react";
import Navbar from "@/components/site/landing/Navbar";
import { Page } from "@/components/site/primitives";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { FacilityMap } from "@/components/site/facilities/facility-map-loader";
import { appNav, facilityScreen } from "@/content/app";
import { cityCenter, formatDistance, formatPhone } from "@/content/facilities";
import { useNearbyFacilities, type Point } from "@/lib/api/hooks";
import { cn } from "@/lib/utils";

type LocateStatus = "loading" | "ready" | "error";
type Dialog = null | "ask" | "calling";

// Màn hình Cơ sở y tế gần nhất. Đến từ nút SOS (?sos=1) thì mở ngay hộp Gọi 115 / Hủy,
// danh sách và bản đồ vẫn hiện phía sau. Bản demo: không gọi thật.
export default function FacilitiesScreen() {
  const s = facilityScreen;
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [dialog, setDialog] = useState<Dialog>(params.get("sos") ? "ask" : null);
  const [position, setPosition] = useState<Point | null>(null);
  const [status, setStatus] = useState<LocateStatus>("loading");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusVersion, setFocusVersion] = useState(0);
  const callRef = useRef<HTMLButtonElement>(null);

  // State is only set from the geolocation callbacks; the initial status is already "loading".
  const requestPosition = useCallback(() => {
    if (!navigator.geolocation) {
      queueMicrotask(() => setStatus("error")); // async, like the real geolocation callbacks
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (result) => {
        setPosition({ lat: result.coords.latitude, lng: result.coords.longitude });
        setStatus("ready");
      },
      () => setStatus("error"),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  const locate = () => {
    setStatus("loading");
    requestPosition();
  };

  useEffect(() => {
    requestPosition();
    // Bỏ cờ SOS khỏi URL để tải lại trang không mở lại hộp gọi
    if (params.get("sos")) router.replace(pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // SWR: wait for the geolocation result (null key = no request), fall back to the city centre on failure.
  const searchPoint = status === "ready" ? position : status === "error" ? cityCenter : null;
  const { data, error, isLoading, mutate } = useNearbyFacilities(searchPoint);
  const facilities = data ?? [];
  const select = (id: string) => {
    setSelectedId(id);
    setFocusVersion((value) => value + 1);
  };
  const statusText = { loading: s.locating, ready: s.located, error: s.failed }[status];

  const pill = "rounded-full px-2.5 py-0.75 text-xs font-medium";

  return (
    <Page>
      <Navbar appLinks={appNav} />
      <main className="mx-auto w-full max-w-7xl px-4 pt-7 pb-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[clamp(26px,3.4vw,36px)] leading-[1.15] font-black text-ink">{s.title}</h1>
            <p className={cn("mt-2 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground [&_svg]:size-4", status === "error" && "text-brand")} role="status">
              <LocateFixed aria-hidden="true" /> {statusText}
              {status === "error" && (
                <button type="button" className="cursor-pointer rounded-full border border-current px-2.5 py-1 text-[13px] font-semibold" onClick={locate}>{s.retry}</button>
              )}
            </p>
          </div>
          <Button className="h-auto rounded-full px-5.5 py-3 text-base font-bold shadow-[0_10px_24px_rgba(218,54,26,.3)] hover:bg-brand-dark [&_svg]:size-4.5" onClick={() => setDialog("ask")}>
            <Phone aria-hidden="true" /> {s.call115}
          </Button>
        </div>

        <div className="mt-5 grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] items-start gap-5 max-[860px]:grid-cols-1">
          {/* Bản đồ luôn vừa phần màn hình còn lại dưới navbar, kể cả khi thu phóng trình duyệt */}
          <div className="sticky top-21 flex h-[clamp(320px,calc(100svh-100px),640px)] overflow-hidden rounded-2xl border border-line bg-[#eef1ee] max-lg:top-18 max-[860px]:static max-[860px]:h-[clamp(300px,55svh,420px)]">
            <FacilityMap
              facilities={facilities}
              location={status === "ready" ? position : null}
              selectedId={selectedId}
              focusVersion={focusVersion}
              onSelect={select}
            />
          </div>

          <div>
            {error && (
              <p className="my-3 text-[13px] leading-[1.7] text-[#942025]" role="alert">
                {error.message} <button type="button" className="min-h-11 cursor-pointer px-3 py-1 underline" onClick={() => mutate()}>Thử lại</button>
              </p>
            )}
            {isLoading && <p className="p-6 text-sm text-muted-foreground" role="status">Đang tìm cơ sở y tế…</p>}
            {data && data.length === 0 && <p className="p-6 text-sm text-muted-foreground">Chưa có cơ sở nào trong danh mục. Hãy gọi 115.</p>}
            <ol className="grid gap-3" aria-label="Danh sách cơ sở y tế">
              {facilities.map((facility, index) => {
                const selected = selectedId === facility.id;
                return (
                  <li
                    key={facility.id}
                    className={cn("rounded-[14px] border border-line bg-white px-4.5 py-4 transition-[border-color,box-shadow] duration-150", selected && "border-brand shadow-[inset_4px_0_var(--color-brand)]")}
                  >
                    <h2 className="flex items-start gap-2.5 text-[17px] leading-[1.35] font-extrabold text-ink">
                      <span className="inline-grid size-6.5 flex-none place-items-center rounded-full bg-brand-soft text-[13px] font-extrabold text-brand">{index + 1}</span>
                      {facility.name}
                    </h2>
                    <p className="mt-2 flex items-start gap-1.5 text-sm text-muted-foreground"><MapPin aria-hidden="true" className="mt-0.75 size-3.75 flex-none" /> {facility.address}</p>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {facility.hasEmergency && <span className={cn(pill, "bg-brand-soft text-brand")}>{s.emergency}</span>}
                      <span className={cn(pill, "bg-[#f2f2f2] text-ink")}>{formatDistance(facility.distanceMeters)} · {facility.distanceMethod === "ROAD" ? s.distanceRoad : s.distanceNote}</span>
                    </div>
                    {/* Bản demo: số điện thoại chỉ để xem, không mở trình gọi */}
                    <ul className="mt-3 grid gap-1">
                      {facility.phones.map((phone) => (
                        <li key={phone.number} className="flex flex-wrap items-center gap-1.5 text-sm text-ink">
                          <Phone aria-hidden="true" className="size-3.5 text-brand" /> {phone.label}: <strong className="font-bold tabular-nums">{formatPhone(phone.number)}</strong>
                          {phone.is24h && <em className="rounded-full bg-[#fff4d6] px-2 py-px text-[11px] text-[#8a5a00] not-italic">{s.hours24}</em>}
                        </li>
                      ))}
                    </ul>
                    <Button
                      variant="outline"
                      aria-pressed={selected}
                      onClick={() => select(facility.id)}
                      className="mt-3 h-auto rounded-full border-line px-3.5 py-1.75 text-[13px] font-semibold text-ink hover:border-brand hover:bg-white hover:text-brand aria-pressed:border-brand aria-pressed:text-brand"
                    >
                      {s.showOnMap}
                    </Button>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
        <p className="mt-5 text-xs leading-[1.6] text-muted-foreground">{s.source}</p>
      </main>

      {/* Hộp Gọi 115 / Hủy (bản demo không gọi thật) */}
      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent
          showCloseButton={false}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            callRef.current?.focus();
          }}
          className="w-[min(100%,400px)] max-w-[calc(100%-2rem)] gap-0 rounded-[20px] px-6 pt-7 pb-6 text-center shadow-[0_24px_60px_rgba(0,0,0,.25)] ring-0 sm:max-w-100"
        >
          <span
            aria-hidden="true"
            className={cn(
              "mx-auto inline-grid size-15 place-items-center rounded-full [&_svg]:size-6.5",
              dialog === "calling" ? "animate-sos-ring bg-brand text-white motion-reduce:animate-none" : "bg-brand-soft text-brand",
            )}
          >
            <Phone />
          </span>
          <DialogTitle className="mt-3.5 text-2xl leading-[1.2] font-black text-ink">{dialog === "calling" ? s.dialog.calling : s.dialog.title}</DialogTitle>
          <DialogDescription className="mt-2.5 text-[15px] leading-[1.55]">{dialog === "calling" ? s.dialog.demo : s.dialog.text}</DialogDescription>
          <DialogFooter className={cn("mt-5.5 grid gap-2.5 sm:flex-none", dialog === "calling" ? "grid-cols-1" : "grid-cols-2")}>
            {dialog === "calling" ? (
              <Button ref={callRef} className="h-11 rounded-full text-base font-semibold [&_svg]:size-4.5" onClick={() => setDialog(null)}>
                <PhoneOff aria-hidden="true" /> {s.dialog.end}
              </Button>
            ) : (
              <>
                <Button variant="outline" className="h-11 rounded-full border-2 border-line text-base font-semibold hover:border-ink hover:bg-white" onClick={() => setDialog(null)}>
                  {s.dialog.cancel}
                </Button>
                <Button ref={callRef} className="h-11 rounded-full text-base font-semibold [&_svg]:size-4.5" onClick={() => setDialog("calling")}>
                  <Phone aria-hidden="true" /> {s.dialog.call}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
