"use client";

import { useEffect, useState } from "react";
import type { Point } from "@/lib/api/hooks";

// Live GPS position for "Tìm kiếm người hỗ trợ", with an optional demo override.
// Demo mode (NEXT_PUBLIC_DEMO_LOCATION=true) lets each browser tab pretend to stand at a preset place, so a requester and a
// responder in two windows of the same computer are a few hundred metres apart. The choice lives in sessionStorage
// (per tab) and never leaves the browser.

export const DEMO_LOCATION_ENABLED = process.env.NEXT_PUBLIC_DEMO_LOCATION === "true";

export const DEMO_PLACES: { id: string; label: string; point: Point }[] = [
  { id: "ben-thanh", label: "Chợ Bến Thành", point: { lat: 10.7725, lng: 106.698 } },
  { id: "nha-hat", label: "Nhà hát Thành phố", point: { lat: 10.7766, lng: 106.7031 } },
  { id: "duc-ba", label: "Nhà thờ Đức Bà", point: { lat: 10.7798, lng: 106.699 } },
  { id: "bitexco", label: "Bitexco", point: { lat: 10.7716, lng: 106.7044 } },
  { id: "thao-cam-vien", label: "Thảo Cầm Viên (~2 km)", point: { lat: 10.7875, lng: 106.7053 } },
];

const STORAGE_KEY = "sos-demo-place";

function storedPlace(): string {
  try {
    return sessionStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export type PositionStatus = "idle" | "locating" | "ready" | "denied" | "unavailable";

/** `enabled`: start watching (asks for permission). `allowDemo` lets a screen require GPS instead of a saved demo place. */
export function useLivePosition(enabled: boolean, allowDemo = true) {
  const [gps, setGps] = useState<Point | null>(null);
  const [status, setStatus] = useState<PositionStatus>("idle");
  const [demoPlace, setDemoPlaceState] = useState("");

  useEffect(() => {
    if (DEMO_LOCATION_ENABLED && allowDemo) queueMicrotask(() => setDemoPlaceState(storedPlace()));
  }, [allowDemo]);

  useEffect(() => {
    if (!enabled) return;
    if (!navigator.geolocation) {
      queueMicrotask(() => setStatus("unavailable"));
      return;
    }
    queueMicrotask(() => setStatus((current) => (current === "ready" ? current : "locating")));
    const watch = navigator.geolocation.watchPosition(
      (result) => {
        setGps({ lat: result.coords.latitude, lng: result.coords.longitude });
        setStatus("ready");
      },
      (failure) => setStatus(failure.code === failure.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, [enabled]);

  const setDemoPlace = (id: string) => {
    setDemoPlaceState(id);
    try {
      if (id) sessionStorage.setItem(STORAGE_KEY, id);
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // storage blocked: the choice still applies to this page
    }
  };

  const demo = DEMO_LOCATION_ENABLED && allowDemo ? DEMO_PLACES.find((place) => place.id === demoPlace) : undefined;
  const position = demo ? demo.point : gps;
  const effectiveStatus: PositionStatus = demo ? "ready" : status;
  return { position, status: effectiveStatus, demoPlace, setDemoPlace };
}
