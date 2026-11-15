"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bike, Car, LocateFixed, MapPin, Navigation, Phone, PhoneOff, X } from "lucide-react";
import AppNav from "@/components/site/app-nav";
import { Page } from "@/components/site/primitives";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { FacilityMap } from "@/components/site/facilities/facility-map-loader";
import { facilityScreen } from "@/content/app";
import { cityCenter, formatDistance, formatPhone } from "@/content/facilities";
import { useNearbyFacilities, type Point } from "@/lib/api/hooks";
import { formatDuration, useDirections, type Vehicle } from "@/lib/directions";
import { cn } from "@/lib/utils";

const vehicles: { id: Vehicle; label: string; icon: typeof Car }[] = [
  { id: "motorbike", label: "Xe máy", icon: Bike },
  { id: "car", label: "Ô tô", icon: Car },
];

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

  // Dẫn đường: chỉ đường từ vị trí hiện tại (hoặc trung tâm TP.HCM khi chưa định vị được) tới cơ sở đang chọn
  const [routeTo, setRouteTo] = useState<string | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle>("motorbike");
  const [activeRoute, setActiveRoute] = useState(0);
  const target = facilities.find((facility) => facility.id === routeTo) ?? null;
  const directions = useDirections(target ? searchPoint : null, target ? { lat: target.latitude, lng: target.longitude } : null, vehicle);
  const routes = target ? directions.data ?? [] : [];
  const route = routes[Math.min(activeRoute, routes.length - 1)];
  const startDirections = (id: string) => {
    select(id);
    setRouteTo(id);
    setActiveRoute(0);
  };
  const pickVehicle = (next: Vehicle) => {
    setVehicle(next);
    setActiveRoute(0);
  };
  const statusText = { loading: s.locating, ready: s.located, error: s.failed }[status];

  const pill = "rounded-full px-2.5 py-0.75 text-xs font-medium";

  return (
    <Page>
      <AppNav />
      <main className="mx-auto w-full max-w-none px-4 pt-7 pb-10">
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
              routes={routes}
              activeRoute={activeRoute}
              onSelectRoute={setActiveRoute}
              navigating={target !== null && selectedId === target.id}
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
                    {/* Mỗi số tổng đài có nút Gọi mở trình gọi điện của máy (tel:) */}
                    <ul className="mt-3 grid gap-1">
                      {facility.phones.map((phone) => (
                        <li key={phone.number} className="flex flex-wrap items-center gap-1.5 text-sm text-ink">
                          <Phone aria-hidden="true" className="size-3.5 text-brand" /> {phone.label}: <strong className="font-bold tabular-nums">{formatPhone(phone.number)}</strong>
                          {phone.is24h && <em className="rounded-full bg-[#fff4d6] px-2 py-px text-[11px] text-[#8a5a00] not-italic">{s.hours24}</em>}
                          <a
                            href={`tel:${phone.number}`}
                            aria-label={`${s.callNumber} ${phone.label} ${facility.name}: ${formatPhone(phone.number)}`}
                            className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-brand px-3.5 py-1.5 text-[13px] leading-none font-semibold text-white no-underline shadow-[0_6px_14px_rgba(218,54,26,.25)] transition-[background,translate] duration-150 hover:-translate-y-px hover:bg-brand-dark"
                          >
                            <Phone aria-hidden="true" className="size-3.5" /> {s.callNumber}
                          </a>
                        </li>
                      ))}
                    </ul>
                    {routeTo !== facility.id ? (
                      <Button
                        variant="outline"
                        onClick={() => startDirections(facility.id)}
                        className="mt-3 h-auto rounded-full border-line px-3.5 py-1.75 text-[13px] font-semibold text-ink hover:border-[#1a73e8] hover:bg-white hover:text-[#1a73e8] [&_svg]:size-3.5"
                      >
                        <Navigation aria-hidden="true" /> {s.directions.start}
                      </Button>
                    ) : (
                      // Khung chỉ đường: chọn phương tiện, chọn tuyến (khớp với tuyến trên bản đồ), xem từng bước
                      <section className="mt-3 rounded-xl border border-[#d2e3fc] bg-[#f6f9fe] p-3" aria-label={`${s.directions.title} ${facility.name}`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="inline-flex rounded-full bg-white p-0.5 shadow-[inset_0_0_0_1px_#d2e3fc]" role="group" aria-label={s.directions.vehicle}>
                            {vehicles.map(({ id, label, icon: Icon }) => (
                              <button
                                key={id}
                                type="button"
                                aria-pressed={vehicle === id}
                                onClick={() => pickVehicle(id)}
                                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold text-[#3c4043] aria-pressed:bg-[#1a73e8] aria-pressed:text-white [&_svg]:size-4"
                              >
                                <Icon aria-hidden="true" /> {label}
                              </button>
                            ))}
                          </div>
                          <button type="button" onClick={() => setRouteTo(null)} aria-label={s.directions.close} className="grid size-8 cursor-pointer place-items-center rounded-full text-[#5f6368] hover:bg-white [&_svg]:size-4">
                            <X aria-hidden="true" />
                          </button>
                        </div>

                        {status !== "ready" && <p className="mt-2 text-xs text-[#8a5a00]">{s.directions.fromCenter}</p>}
                        {directions.isLoading && <p className="mt-3 text-sm text-muted-foreground" role="status">{s.directions.loading}</p>}
                        {directions.error && (
                          <p className="mt-3 text-sm text-[#942025]" role="alert">
                            {directions.error.message}{" "}
                            <button type="button" className="cursor-pointer underline" onClick={() => directions.mutate()}>Thử lại</button>
                          </p>
                        )}

                        {routes.length > 0 && (
                          <>
                            <ul className="mt-3 grid gap-1.5" aria-label={s.directions.routes}>
                              {routes.map((option, index) => (
                                <li key={index}>
                                  <button
                                    type="button"
                                    aria-pressed={index === activeRoute}
                                    onClick={() => setActiveRoute(index)}
                                    className="flex w-full cursor-pointer items-baseline gap-2 rounded-lg border border-transparent bg-white px-3 py-2 text-left aria-pressed:border-[#1a73e8] aria-pressed:shadow-[inset_3px_0_#1a73e8]"
                                  >
                                    <strong className={cn("text-[17px] font-bold", index === activeRoute ? "text-[#1a73e8]" : "text-ink")}>{formatDuration(option.duration)}</strong>
                                    <span className="text-[13px] text-muted-foreground">{formatDistance(option.distance)}</span>
                                    <span className="ml-auto text-xs text-muted-foreground">{index === 0 ? s.directions.best : s.directions.alternative}</span>
                                  </button>
                                </li>
                              ))}
                            </ul>
                            {vehicle === "motorbike" && <p className="mt-2 text-[11px] leading-snug text-muted-foreground">{s.directions.motorbikeNote}</p>}
                            {route && (
                              <details className="mt-2 group">
                                <summary className="cursor-pointer text-[13px] font-semibold text-[#1a73e8]">{s.directions.steps} ({route.steps.length})</summary>
                                <ol className="mt-2 grid max-h-64 gap-1.5 overflow-y-auto pr-1">
                                  {route.steps.map((step, index) => (
                                    <li key={index} className="flex gap-2 text-[13px] leading-snug text-ink">
                                      <span className="mt-px inline-grid size-5 flex-none place-items-center rounded-full bg-[#e8f0fe] text-[11px] font-bold text-[#1a73e8]">{index + 1}</span>
                                      <span>
                                        {step.instruction}
                                        {step.distance > 0 && <span className="text-muted-foreground"> · {formatDistance(step.distance)}</span>}
                                      </span>
                                    </li>
                                  ))}
                                </ol>
                              </details>
                            )}
                          </>
                        )}
                      </section>
                    )}
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
