"use client";

import useSWR from "swr";
import type { ApiError } from "./client";
import type { Facility } from "./types";

export type Point = { lat: number; lng: number };

// ~11 m precision keeps the SWR key stable while the GPS jitters, and avoids keeping exact positions.
const round = (value: number) => value.toFixed(4);

/** Nearest verified facilities. Pass `null` to skip fetching until a position is known. */
export function useNearbyFacilities(point: Point | null, limit = 5) {
  const key = point
    ? `/api/facilities/nearby?${new URLSearchParams({ lat: round(point.lat), lng: round(point.lng), limit: String(limit) })}`
    : null;
  return useSWR<Facility[], ApiError>(key);
}

export function useDistricts() {
  return useSWR<string[], ApiError>("/api/districts");
}
