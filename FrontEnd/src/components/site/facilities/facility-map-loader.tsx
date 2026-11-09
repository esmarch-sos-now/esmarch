"use client";

import dynamic from "next/dynamic";

// mapbox-gl touches `window`/WebGL, so it is loaded in the browser only.
export const FacilityMap = dynamic(() => import("./facility-map"), {
  ssr: false,
  loading: () => <p className="facilities-map-note">Đang mở bản đồ…</p>,
});
