import type { Point } from "@/lib/api/hooks";

// Demo only: the requester and the supporter run in browsers on the same computer, so both read the same GPS position.
// The supporter's position is therefore shifted this far north so there is a real route and distance to show.
export const DEMO_SUPPORTER_OFFSET_METERS = 1000;

const METERS_PER_DEGREE_LAT = 111_320;

/** `point` moved `meters` to the north; null stays null. */
export function offsetNorth(point: Point | null, meters: number): Point | null {
  return point ? { lat: point.lat + meters / METERS_PER_DEGREE_LAT, lng: point.lng } : null;
}
