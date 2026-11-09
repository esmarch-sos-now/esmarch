"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LocateFixed, MapPin, Phone, PhoneOff } from "lucide-react";
import Navbar from "@/components/site/landing/Navbar";
import { FacilityMap } from "@/components/site/facilities/facility-map-loader";
import { appNav, facilityScreen } from "@/content/app";
import { cityCenter, formatDistance, formatPhone } from "@/content/facilities";
import { useNearbyFacilities, type Point } from "@/lib/api/hooks";

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

  useEffect(() => {
    if (!dialog) return;
    callRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDialog(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialog]);

  // SWR: wait for the geolocation result (null key = no request), fall back to the city centre on failure.
  const searchPoint = status === "ready" ? position : status === "error" ? cityCenter : null;
  const { data, error, isLoading, mutate } = useNearbyFacilities(searchPoint);
  const facilities = data ?? [];
  const select = (id: string) => {
    setSelectedId(id);
    setFocusVersion((value) => value + 1);
  };
  const statusText = { loading: s.locating, ready: s.located, error: s.failed }[status];

  return (
    <div className="page">
      <Navbar appLinks={appNav} />
      <main className="container facilities">
        <div className="facilities-head">
          <div>
            <h1 className="facilities-title">{s.title}</h1>
            <p className={`facilities-status ${status === "error" ? "is-error" : ""}`} role="status">
              <LocateFixed aria-hidden="true" /> {statusText}
              {status === "error" && <button type="button" onClick={locate}>{s.retry}</button>}
            </p>
          </div>
          <button type="button" className="facilities-call" onClick={() => setDialog("ask")}><Phone aria-hidden="true" /> {s.call115}</button>
        </div>

        <div className="facilities-body">
          <div className="facilities-map">
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
              <p className="facility-feedback" role="alert">
                {error.message} <button type="button" onClick={() => mutate()}>Thử lại</button>
              </p>
            )}
            {isLoading && <p className="facilities-map-note" role="status">Đang tìm cơ sở y tế…</p>}
            {data && data.length === 0 && <p className="facilities-map-note">Chưa có cơ sở nào trong danh mục. Hãy gọi 115.</p>}
            <ol className="facilities-list" aria-label="Danh sách cơ sở y tế">
              {facilities.map((facility, index) => (
                <li key={facility.id} className={selectedId === facility.id ? "is-selected" : ""}>
                  <h2><span>{index + 1}</span>{facility.name}</h2>
                  <p className="facilities-address"><MapPin aria-hidden="true" /> {facility.address}</p>
                  <div className="facilities-tags">
                    {facility.hasEmergency && <span className="is-red">{s.emergency}</span>}
                    <span>{formatDistance(facility.distanceMeters)} · {facility.distanceMethod === "ROAD" ? s.distanceRoad : s.distanceNote}</span>
                  </div>
                  {/* Bản demo: số điện thoại chỉ để xem, không mở trình gọi */}
                  <ul className="facilities-phones">
                    {facility.phones.map((phone) => (
                      <li key={phone.number}><Phone aria-hidden="true" /> {phone.label}: <strong>{formatPhone(phone.number)}</strong>{phone.is24h && <em>{s.hours24}</em>}</li>
                    ))}
                  </ul>
                  <button type="button" className="facilities-show" aria-pressed={selectedId === facility.id} onClick={() => select(facility.id)}>{s.showOnMap}</button>
                </li>
              ))}
            </ol>
          </div>
        </div>
        <p className="facilities-source">{s.source}</p>
      </main>

      {dialog && (
        <div className="sos-dialog-backdrop" onClick={() => setDialog(null)}>
          <div className="sos-dialog" role="dialog" aria-modal="true" aria-labelledby="sos-dialog-title" onClick={(event) => event.stopPropagation()}>
            {dialog === "ask" ? (
              <>
                <span className="sos-dialog-icon" aria-hidden="true"><Phone /></span>
                <h2 id="sos-dialog-title" className="sos-dialog-title">{s.dialog.title}</h2>
                <p className="sos-dialog-text">{s.dialog.text}</p>
                <div className="sos-dialog-actions">
                  <button type="button" className="button button-outline" onClick={() => setDialog(null)}>{s.dialog.cancel}</button>
                  <button ref={callRef} type="button" className="button button-primary" onClick={() => setDialog("calling")}><Phone aria-hidden="true" /> {s.dialog.call}</button>
                </div>
              </>
            ) : (
              <>
                <span className="sos-dialog-icon is-calling" aria-hidden="true"><Phone /></span>
                <h2 id="sos-dialog-title" className="sos-dialog-title">{s.dialog.calling}</h2>
                <p className="sos-dialog-text">{s.dialog.demo}</p>
                <div className="sos-dialog-actions is-single">
                  <button ref={callRef} type="button" className="button button-primary" onClick={() => setDialog(null)}><PhoneOff aria-hidden="true" /> {s.dialog.end}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
