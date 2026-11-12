"use client";

import useSWR from "swr";
import type { Point } from "@/lib/api/hooks";

// Chỉ đường bằng Mapbox Directions API (cùng token với bản đồ). Mapbox không có chế độ riêng cho xe máy:
// - Ô tô: profile driving-traffic (có tính kẹt xe hiện tại).
// - Xe máy: profile driving nhưng tránh đường cao tốc (xe máy không được đi cao tốc ở Việt Nam); thời gian là ước tính.
// Tài liệu: https://docs.mapbox.com/api/navigation/directions/

export type Vehicle = "motorbike" | "car";

export type RouteStep = { instruction: string; distance: number };
export type Route = {
  /** [lng, lat] theo GeoJSON */
  coordinates: [number, number][];
  /** giây */
  duration: number;
  /** mét */
  distance: number;
  steps: RouteStep[];
};

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

const PROFILE: Record<Vehicle, { profile: string; exclude?: string }> = {
  car: { profile: "mapbox/driving-traffic" },
  motorbike: { profile: "mapbox/driving", exclude: "motorway" },
};

type MapboxResponse = {
  code: string;
  message?: string;
  routes?: {
    duration: number;
    distance: number;
    geometry: { coordinates: [number, number][] };
    legs: { steps: { distance: number; maneuver: { instruction: string } }[] }[];
  }[];
};

async function fetchRoutes([, vehicle, from, to]: [string, Vehicle, string, string]): Promise<Route[]> {
  const { profile, exclude } = PROFILE[vehicle];
  const params = new URLSearchParams({
    alternatives: "true",
    geometries: "geojson",
    overview: "full",
    steps: "true",
    language: "vi",
    access_token: TOKEN ?? "",
  });
  if (exclude) params.set("exclude", exclude);
  const response = await fetch(`https://api.mapbox.com/directions/v5/${profile}/${from};${to}?${params}`);
  const body = (await response.json().catch(() => null)) as MapboxResponse | null;
  if (!response.ok || !body || body.code !== "Ok") {
    throw new Error(body?.code === "NoRoute" ? "Không tìm được đường đi tới cơ sở này." : "Chưa lấy được đường đi. Hãy thử lại.");
  }
  return (body.routes ?? []).map((route) => ({
    coordinates: route.geometry.coordinates,
    duration: route.duration,
    distance: route.distance,
    steps: route.legs.flatMap((leg) => leg.steps.map((step) => ({ instruction: step.maneuver.instruction, distance: step.distance }))),
  }));
}

// ~11 m precision: the key stays stable while the GPS jitters.
const coord = (point: Point) => `${point.lng.toFixed(4)},${point.lat.toFixed(4)}`;

/** Các tuyến đường (tuyến đầu là tuyến đề xuất) từ `from` tới `to`. Truyền `null` để không tải. */
export function useDirections(from: Point | null, to: Point | null, vehicle: Vehicle) {
  const key = TOKEN && from && to ? (["directions", vehicle, coord(from), coord(to)] as [string, Vehicle, string, string]) : null;
  return useSWR<Route[], Error>(key, fetchRoutes, { revalidateOnFocus: false, shouldRetryOnError: false });
}

/** 9 phút, 1 giờ 5 phút */
export function formatDuration(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} giờ ${rest} phút` : `${hours} giờ`;
}
