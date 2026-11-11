"use client";

import dynamic from "next/dynamic";

// mapbox-gl touches `window`/WebGL, so it is loaded in the browser only.
export const FacilityMap = dynamic(() => import("./facility-map"), {
  ssr: false,
  loading: () => <p className="p-6 text-sm text-muted-foreground">Đang mở bản đồ…</p>,
});
