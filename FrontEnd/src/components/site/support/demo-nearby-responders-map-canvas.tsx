"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import type { Point } from "@/lib/api/hooks";
import { getDemoResponders } from "@/lib/support/demo-responders";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

function userMarker(): HTMLElement {
  const element = document.createElement("div");
  element.className = "grid size-10 place-items-center rounded-full border-[3px] border-white bg-blue-600 text-[10px] font-black text-white shadow-lg";
  element.setAttribute("role", "img");
  element.setAttribute("aria-label", "Vị trí hiện tại của bạn");
  element.textContent = "Bạn";
  return element;
}

function responderMarker(index: number): HTMLElement {
  const element = document.createElement("div");
  element.className = "grid size-8 place-items-center rounded-full border-2 border-white bg-emerald-600 text-[10px] font-bold text-white shadow-md";
  element.setAttribute("role", "img");
  element.setAttribute("aria-label", `Người hỗ trợ mô phỏng ${index + 1}, sẵn sàng giúp`);
  element.title = `Người hỗ trợ demo ${index + 1} · Sẵn sàng giúp`;
  element.textContent = String(index + 1);
  return element;
}

export default function DemoNearbyRespondersMapCanvas({ center }: { center: Point }) {
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(!TOKEN);

  useEffect(() => {
    if (!TOKEN || !container.current) return;
    mapboxgl.accessToken = TOKEN;
    const map = new mapboxgl.Map({
      container: container.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [center.lng, center.lat],
      zoom: 13,
      maxZoom: 18,
      scrollZoom: false,
    });
    const markers: mapboxgl.Marker[] = [];
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");

    const onLoad = () => {
      setFailed(false);
      const bounds = new mapboxgl.LngLatBounds().extend([center.lng, center.lat]);
      markers.push(new mapboxgl.Marker({ element: userMarker(), anchor: "center" }).setLngLat([center.lng, center.lat]).addTo(map));
      getDemoResponders({ lat: center.lat, lng: center.lng }).forEach(({ id, point }) => {
        bounds.extend([point.lng, point.lat]);
        markers.push(new mapboxgl.Marker({ element: responderMarker(id - 1), anchor: "center" }).setLngLat([point.lng, point.lat]).addTo(map));
      });
      map.fitBounds(bounds, { padding: { top: 70, bottom: 70, left: 60, right: 60 }, maxZoom: 14, duration: 0 });
      // Start closer than the fit-all view (less crowded); the farthest helpers can be reached by panning/zooming out.
      map.jumpTo({ center: [center.lng, center.lat], zoom: map.getZoom() + 0.8 });
    };
    const onError = () => { if (!map.isStyleLoaded()) setFailed(true); };
    map.on("load", onLoad);
    map.on("error", onError);
    const resize = new ResizeObserver(() => map.resize());
    resize.observe(container.current);

    return () => {
      resize.disconnect();
      map.off("load", onLoad);
      map.off("error", onError);
      markers.forEach((marker) => marker.remove());
      map.remove();
    };
  }, [center.lat, center.lng]);

  return (
    <div className="relative h-full min-h-[340px] w-full bg-[#e8efe8]">
      <div ref={container} className="h-full min-h-[340px] w-full" role="region" aria-label="Bản đồ với 20 người đang sẵn sàng giúp quanh vị trí hiện tại" />
      {failed && (
        <p className="absolute right-4 bottom-4 left-4 rounded-xl bg-white/95 p-3 text-center text-sm text-brand shadow" role="status">
          Bản đồ chưa tải được. Kiểm tra token Mapbox và thử tải lại trang.
        </p>
      )}
    </div>
  );
}
