"use client";

import { useMemo } from "react";
import { FacilityMap } from "@/components/site/facilities/facility-map-loader";
import type { Point } from "@/lib/api/hooks";
import type { Facility } from "@/lib/api/types";
import type { Route } from "@/lib/directions";

// The facilities map reused for "Tìm kiếm người hỗ trợ": one red pin (the other person) and the blue "you" pin,
// optionally with routes drawn between them.
export default function PointMap({
  me,
  other,
  label,
  routes,
  activeRoute,
  onSelectRoute,
}: {
  me: Point | null;
  other: Point | null;
  label: string;
  routes?: Route[];
  activeRoute?: number;
  onSelectRoute?: (index: number) => void;
}) {
  // Stable array: the map re-creates its pins (and re-fits) whenever this changes
  const lat = other?.lat;
  const lng = other?.lng;
  const place = useMemo<Facility[]>(
    () =>
      lat !== undefined && lng !== undefined
        ? [
            {
              id: "support-point",
              name: label,
              type: "HOSPITAL",
              address: "",
              district: "",
              latitude: lat,
              longitude: lng,
              hasEmergency: false,
              phones: [],
              verifiedAt: "",
            },
          ]
        : [],
    [lat, lng, label],
  );
  return (
    <div className="flex h-[clamp(280px,48svh,440px)] overflow-hidden rounded-2xl border border-line bg-[#eef1ee]">
      <FacilityMap
        facilities={place}
        location={me}
        selectedId={null}
        focusVersion={0}
        onSelect={() => undefined}
        routes={routes}
        activeRoute={activeRoute}
        onSelectRoute={onSelectRoute}
        navigating
        placeLabel={label}
      />
    </div>
  );
}
