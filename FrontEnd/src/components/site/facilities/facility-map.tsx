"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import { cityCenter } from "@/content/facilities";
import type { Facility } from "@/lib/api/types";
import type { Point } from "@/lib/api/hooks";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
const STYLE = "mapbox://styles/mapbox/streets-v12";
const DEFAULT_ZOOM = 13;
const MAX_ZOOM = 19;

type Props = {
  facilities: Facility[];
  location: Point | null;
  selectedId: string | null;
  focusVersion: number;
  onSelect: (id: string) => void;
};

// Popup content is built from text nodes: facility data is rendered as text, never as HTML.
function facilityPopup(facility: Facility, onSelect: (id: string) => void): HTMLElement {
  const popup = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = facility.name;
  const address = document.createElement("p");
  address.textContent = facility.address;
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Xem thông tin cơ sở";
  button.addEventListener("click", () => onSelect(facility.id));
  popup.append(title, address, button);
  return popup;
}

function userMarker(): HTMLElement {
  const element = document.createElement("div");
  element.className = "facility-map-marker facility-map-marker--user";
  element.setAttribute("role", "img");
  element.setAttribute("aria-label", "Vị trí của bạn");
  const text = document.createElement("span");
  text.textContent = "U";
  element.append(text);
  return element;
}

function facilityMarker(index: number, name: string): HTMLButtonElement {
  const element = document.createElement("button");
  element.type = "button";
  element.className = "facility-map-marker facility-map-marker--facility";
  element.setAttribute("aria-label", `${index + 1}. ${name}`);
  const text = document.createElement("span");
  text.textContent = String(index + 1);
  element.append(text);
  return element;
}

export default function FacilityMap({ facilities, location, selectedId, focusVersion, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markers = useRef(new Map<string, mapboxgl.Marker>());
  const fit = useRef<(() => void) | null>(null);
  const selected = useRef(selectedId);
  const onSelectRef = useRef(onSelect);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(!TOKEN);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    selected.current = selectedId;
    onSelectRef.current = onSelect;
  });

  // Create the map once per mount (official mapbox-gl usage: set accessToken, new Map({ container, style })).
  useEffect(() => {
    if (!TOKEN || !container.current) return;
    mapboxgl.accessToken = TOKEN;
    const map = new mapboxgl.Map({
      container: container.current,
      style: STYLE,
      center: [cityCenter.lng, cityCenter.lat],
      zoom: DEFAULT_ZOOM,
      maxZoom: MAX_ZOOM,
      scrollZoom: false,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");
    mapRef.current = map;
    const onLoad = () => setReady(true);
    const onError = () => { if (!map.isStyleLoaded()) setFailed(true); };
    map.on("load", onLoad);
    map.on("error", onError);
    // Frame resized (browser zoom, rotation): redraw and re-fit while nothing is selected.
    const resize = new ResizeObserver(() => {
      map.resize();
      if (!selected.current) fit.current?.();
    });
    resize.observe(container.current);
    const currentMarkers = markers.current;
    return () => {
      resize.disconnect();
      currentMarkers.forEach((marker) => marker.remove());
      currentMarkers.clear();
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [retry]);

  // Markers + bounds follow the data.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const next = new Map<string, mapboxgl.Marker>();
    const points: [number, number][] = [];
    if (location) {
      const point: [number, number] = [location.lng, location.lat];
      next.set("__user-location__", new mapboxgl.Marker({ element: userMarker(), anchor: "bottom" }).setLngLat(point).addTo(map));
      points.push(point);
    }
    facilities.forEach((facility, index) => {
      const point: [number, number] = [facility.longitude, facility.latitude];
      const element = facilityMarker(index, facility.name);
      const marker = new mapboxgl.Marker({ element, anchor: "bottom" })
        .setLngLat(point)
        // focusAfterOpen: false so opening a popup from the list does not scroll the page to the map
        .setPopup(
          new mapboxgl.Popup({ offset: 23, maxWidth: "280px", focusAfterOpen: false }).setDOMContent(
            facilityPopup(facility, (id) => onSelectRef.current(id)),
          ),
        )
        .addTo(map);
      element.addEventListener("click", () => onSelectRef.current(facility.id));
      next.set(facility.id, marker);
      points.push(point);
    });
    markers.current = next;
    fit.current = () => {
      if (points.length === 1) map.setCenter(points[0]).setZoom(15);
      else if (points.length > 1) {
        const bounds = new mapboxgl.LngLatBounds();
        points.forEach((point) => bounds.extend(point));
        map.fitBounds(bounds, { padding: 36, maxZoom: 15, duration: 0 });
      } else map.setCenter([cityCenter.lng, cityCenter.lat]).setZoom(DEFAULT_ZOOM);
    };
    fit.current();
    return () => {
      next.forEach((marker) => marker.remove());
      markers.current = new Map();
      fit.current = null;
    };
  }, [facilities, location, ready]);

  // Selecting a facility (pin or list) flies there and opens its popup.
  useEffect(() => {
    const map = mapRef.current;
    const marker = selectedId ? markers.current.get(selectedId) : undefined;
    if (!map || !marker) return;
    map.flyTo({ center: marker.getLngLat(), zoom: 16 });
    if (!marker.getPopup()?.isOpen()) marker.togglePopup();
  }, [selectedId, focusVersion]);

  return (
    <div className="facility-map-frame">
      <div
        ref={container}
        className="facility-map-canvas facility-map-canvas--vector"
        role="region"
        aria-label="Bản đồ cơ sở y tế. Kéo để di chuyển, dùng nút thu phóng hoặc chọn một ghim để xem thông tin."
      />
      <p className="facility-map-legend">
        <span className="facility-pin-dot" /> Cơ sở y tế <span className="facility-user-dot" /> Vị trí của bạn
      </p>
      {failed && (
        <p className="facility-feedback" role="status">
          {TOKEN
            ? "Bản đồ chưa tải được. Bạn vẫn có thể xem địa chỉ và gọi từ danh sách. "
            : "Chưa cấu hình NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN nên chưa hiện bản đồ. Danh sách bên dưới vẫn dùng được. "}
          {TOKEN && (
            <button type="button" onClick={() => { setFailed(false); setRetry((value) => value + 1); }}>
              Tải lại bản đồ
            </button>
          )}
        </p>
      )}
    </div>
  );
}
