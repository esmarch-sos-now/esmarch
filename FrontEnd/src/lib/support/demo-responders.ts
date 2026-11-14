import type { Point } from "@/lib/api/hooks";

export type DemoResponder = {
  id: number;
  point: Point;
  distanceMeters: number;
};

const RESPONDER_COUNT = 20;
const EARTH_RADIUS_METERS = 6_371_000;

function distanceBetween(first: Point, second: Point): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(second.lat - first.lat);
  const longitudeDelta = toRadians(second.lng - first.lng);
  const firstLatitude = toRadians(first.lat);
  const secondLatitude = toRadians(second.lat);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(Math.min(1, a)));
}

export function getDemoResponders(center: Point): DemoResponder[] {
  const latitudeScale = 1 / 111_320;
  const longitudeScale = 1 / (111_320 * Math.max(Math.cos((center.lat * Math.PI) / 180), 0.1));

  return Array.from({ length: RESPONDER_COUNT }, (_, index) => {
    const angle = (index * 137.5 * Math.PI) / 180;
    const radius = 180 + ((index * 7) % RESPONDER_COUNT) * 85;
    const point = {
      lat: center.lat + Math.cos(angle) * radius * latitudeScale,
      lng: center.lng + Math.sin(angle) * radius * longitudeScale,
    };

    return { id: index + 1, point, distanceMeters: distanceBetween(center, point) };
  });
}

export function getNearestDemoResponders(center: Point, limit = 3): DemoResponder[] {
  return getDemoResponders(center)
    .sort((first, second) => first.distanceMeters - second.distanceMeters)
    .slice(0, limit);
}
