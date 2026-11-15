import type { Point } from "@/lib/api/hooks";

// The backend notifies supporters by registered area (the legacy HCMC district labels from /api/support-areas), so the
// requester's GPS position is turned into the nearest district. Approximate district centres only: near a border the
// result can be the neighbouring district. Demo-level; replace with a real boundary lookup later.
const DISTRICT_CENTRES: { name: string; point: Point }[] = [
  { name: "Quận 1", point: { lat: 10.7769, lng: 106.7009 } },
  { name: "Quận 3", point: { lat: 10.7843, lng: 106.6844 } },
  { name: "Quận 4", point: { lat: 10.7578, lng: 106.7013 } },
  { name: "Quận 5", point: { lat: 10.754, lng: 106.667 } },
  { name: "Quận 6", point: { lat: 10.7463, lng: 106.635 } },
  { name: "Quận 7", point: { lat: 10.734, lng: 106.722 } },
  { name: "Quận 8", point: { lat: 10.724, lng: 106.628 } },
  { name: "Quận 10", point: { lat: 10.7746, lng: 106.6679 } },
  { name: "Quận 11", point: { lat: 10.7629, lng: 106.65 } },
  { name: "Quận 12", point: { lat: 10.8672, lng: 106.6414 } },
  { name: "Bình Tân", point: { lat: 10.7654, lng: 106.6038 } },
  { name: "Bình Thạnh", point: { lat: 10.8106, lng: 106.7091 } },
  { name: "Gò Vấp", point: { lat: 10.8386, lng: 106.6652 } },
  { name: "Phú Nhuận", point: { lat: 10.7992, lng: 106.6803 } },
  { name: "Tân Bình", point: { lat: 10.8014, lng: 106.6527 } },
  { name: "Tân Phú", point: { lat: 10.7906, lng: 106.628 } },
  { name: "Thủ Đức", point: { lat: 10.8494, lng: 106.7537 } },
  { name: "Bình Chánh", point: { lat: 10.687, lng: 106.594 } },
  { name: "Cần Giờ", point: { lat: 10.4114, lng: 106.9544 } },
  { name: "Củ Chi", point: { lat: 10.9733, lng: 106.493 } },
  { name: "Hóc Môn", point: { lat: 10.883, lng: 106.592 } },
  { name: "Nhà Bè", point: { lat: 10.695, lng: 106.737 } },
];

/** Name of the district whose centre is closest to `point` (flat-earth distance is enough at city scale). */
export function nearestDistrict(point: Point): string {
  const metresPerLng = Math.cos((point.lat * Math.PI) / 180);
  let best = DISTRICT_CENTRES[0];
  let bestDistance = Infinity;
  for (const district of DISTRICT_CENTRES) {
    const distance = (district.point.lat - point.lat) ** 2 + ((district.point.lng - point.lng) * metresPerLng) ** 2;
    if (distance < bestDistance) {
      best = district;
      bestDistance = distance;
    }
  }
  return best.name;
}
