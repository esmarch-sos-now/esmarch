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

export function useSupportAreas() {
  return useSWR<string[], ApiError>("/api/support-areas");
}

/** Whether the requester form offers voice input: the backend says so (it has an OpenAI key). Off until it answers. */
export function useVoiceInputEnabled(): boolean {
  const { data } = useSWR<{ enabled: boolean }, ApiError>("/api/support/transcribe");
  return data?.enabled === true;
}
