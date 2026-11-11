"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import { cityCenter, formatDistance } from "@/content/facilities";
import type { Facility } from "@/lib/api/types";
import type { Point } from "@/lib/api/hooks";
import { formatDuration, type Route } from "@/lib/directions";

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
  /** Tuyến đường đang chỉ (tuyến 0 là đề xuất); rỗng thì không vẽ */
  routes?: Route[];
  activeRoute?: number;
  onSelectRoute?: (index: number) => void;
  /** Đang chỉ đường tới cơ sở được chọn: không bay tới ghim / mở popup (popup che mất tuyến đường) */
  navigating?: boolean;
  /** Chữ chú thích dưới bản đồ khi dùng lại bản đồ này cho việc khác (vd. "Người cần hỗ trợ") */
  placeLabel?: string;
};

const ROUTE_SOURCE = "directions";
const ROUTE_BLUE = "#1a73e8";
const ROUTE_GREY = "#9aa0a6";

// Nhãn thời gian + quãng đường đặt giữa tuyến, như hộp chú thích trên Google Maps: tuyến đang chọn nền xanh, tuyến khác nền trắng.
function routeLabel(route: Route, active: boolean): HTMLButtonElement {
  const element = document.createElement("button");
  element.type = "button";
  element.className = [
    "cursor-pointer rounded-md px-2.5 py-1.5 text-left leading-tight shadow-[0_2px_8px_rgb(0_0_0/25%)]",
    active ? "z-2 bg-[#1a73e8] text-white" : "z-1 bg-white text-[#202124]",
  ].join(" ");
  element.setAttribute("aria-label", `Chọn tuyến ${formatDuration(route.duration)}, ${formatDistance(route.distance)}`);
  const time = document.createElement("strong");
  time.className = "block text-[15px] font-semibold";
  time.textContent = formatDuration(route.duration);
  const distance = document.createElement("span");
  distance.className = "block text-[11px] opacity-85";
  distance.textContent = formatDistance(route.distance);
  element.append(time, distance);
  return element;
}

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

// Round numbered pin with a little tail (rotated square). Mapbox positions it absolutely.
const MARKER =
  "grid size-8 place-items-center rounded-full border-3 border-white p-0 text-[11px] leading-none font-bold text-white shadow-[0_2px_7px_rgb(34_38_41/32%)] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#f5cc53] " +
  "after:absolute after:-bottom-1.25 after:left-2 after:z-0 after:size-2.5 after:rotate-45 after:border-r-3 after:border-b-3 after:border-white after:bg-inherit after:content-[''] [&>span]:relative [&>span]:z-1";

function userMarker(): HTMLElement {
  const element = document.createElement("div");
  element.className = `${MARKER} cursor-default bg-[#2563eb]`;
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
  element.className = `${MARKER} cursor-pointer bg-[#bf2b2f]`;
  element.setAttribute("aria-label", `${index + 1}. ${name}`);
  const text = document.createElement("span");
  text.textContent = String(index + 1);
  element.append(text);
  return element;
}

export default function FacilityMap({ facilities, location, selectedId, focusVersion, onSelect, routes = [], activeRoute = 0, onSelectRoute, navigating = false, placeLabel = "Cơ sở y tế" }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markers = useRef(new Map<string, mapboxgl.Marker>());
  const fit = useRef<(() => void) | null>(null);
  const selected = useRef(selectedId);
  const onSelectRef = useRef(onSelect);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(!TOKEN);
  const [retry, setRetry] = useState(0);

  const onSelectRouteRef = useRef(onSelectRoute);

  useEffect(() => {
    selected.current = selectedId;
    onSelectRef.current = onSelect;
    onSelectRouteRef.current = onSelectRoute;
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
    if (navigating) {
      if (marker.getPopup()?.isOpen()) marker.togglePopup();
      return; // khung nhìn do tuyến đường quyết định (fitBounds bên dưới)
    }
    map.flyTo({ center: marker.getLngLat(), zoom: 16 });
    if (!marker.getPopup()?.isOpen()) marker.togglePopup();
  }, [selectedId, focusVersion, navigating]);

  // Tuyến đường: tuyến khác màu xám, tuyến đang chọn màu xanh có viền trắng (vẽ sau cùng để nằm trên), bấm tuyến xám để chọn.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const data = {
      type: "FeatureCollection" as const,
      features: routes.map((route, index) => ({
        type: "Feature" as const,
        properties: { index, active: index === activeRoute },
        geometry: { type: "LineString" as const, coordinates: route.coordinates },
      })),
    };
    const source = map.getSource<mapboxgl.GeoJSONSource>(ROUTE_SOURCE);
    if (source) source.setData(data);
    else {
      map.addSource(ROUTE_SOURCE, { type: "geojson", data });
      const line = { "line-join": "round", "line-cap": "round" } as const;
      map.addLayer({ id: "route-alt", type: "line", source: ROUTE_SOURCE, filter: ["==", ["get", "active"], false], layout: line, paint: { "line-color": ROUTE_GREY, "line-width": 6 } });
      map.addLayer({ id: "route-casing", type: "line", source: ROUTE_SOURCE, filter: ["==", ["get", "active"], true], layout: line, paint: { "line-color": "#ffffff", "line-width": 10 } });
      map.addLayer({ id: "route-main", type: "line", source: ROUTE_SOURCE, filter: ["==", ["get", "active"], true], layout: line, paint: { "line-color": ROUTE_BLUE, "line-width": 6 } });
      map.on("click", "route-alt", (event) => {
        const feature = event.features?.[0] as { properties?: { index?: unknown } } | undefined;
        const index = feature?.properties?.index;
        if (typeof index === "number") onSelectRouteRef.current?.(index);
      });
      map.on("mouseenter", "route-alt", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "route-alt", () => { map.getCanvas().style.cursor = ""; });
    }
    // Nhãn ở khoảng giữa mỗi tuyến (lệch nhau một chút để hai nhãn không chồng lên nhau)
    const labels = routes.map((route, index) => {
      const at = route.coordinates[Math.floor(route.coordinates.length * (index === 0 ? 0.45 : 0.6))];
      const element = routeLabel(route, index === activeRoute);
      element.addEventListener("click", () => onSelectRouteRef.current?.(index));
      return new mapboxgl.Marker({ element, anchor: "bottom" }).setLngLat(at).addTo(map);
    });
    return () => labels.forEach((label) => label.remove());
  }, [routes, activeRoute, ready]);

  // Có tuyến mới thì thu phóng để thấy trọn đường đi
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || routes.length === 0) return;
    const bounds = new mapboxgl.LngLatBounds();
    routes.forEach((route) => route.coordinates.forEach((point) => bounds.extend(point)));
    map.fitBounds(bounds, { padding: { top: 70, bottom: 70, left: 60, right: 60 }, maxZoom: 16 });
  }, [routes, ready]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {/* Mapbox renders its own DOM (popups, controls); style it through descendant selectors. */}
      <div
        ref={container}
        className={[
          "relative isolate z-0 min-h-0 w-full flex-1 overflow-hidden bg-[#e8efe8] text-[#292624]",
          "[&_.mapboxgl-popup-content]:w-[min(260px,calc(100vw-128px))]! [&_.mapboxgl-popup-content]:wrap-anywhere",
          "[&_.mapboxgl-popup-content_strong]:mb-1.75 [&_.mapboxgl-popup-content_strong]:block [&_.mapboxgl-popup-content_strong]:text-sm [&_.mapboxgl-popup-content_strong]:leading-normal",
          "[&_.mapboxgl-popup-content_p]:mb-2.5 [&_.mapboxgl-popup-content_p]:text-xs [&_.mapboxgl-popup-content_p]:leading-[1.7]",
          "[&_.mapboxgl-popup-content_button]:min-h-10 [&_.mapboxgl-popup-content_button]:cursor-pointer [&_.mapboxgl-popup-content_button]:rounded-sm [&_.mapboxgl-popup-content_button]:border [&_.mapboxgl-popup-content_button]:border-[#d8cfc5] [&_.mapboxgl-popup-content_button]:bg-white [&_.mapboxgl-popup-content_button]:px-2.5 [&_.mapboxgl-popup-content_button]:py-1.75 [&_.mapboxgl-popup-content_button]:text-[#942025]",
          "[&_.mapboxgl-ctrl-group]:overflow-hidden [&_.mapboxgl-ctrl-group]:rounded-md [&_.mapboxgl-ctrl-group]:border [&_.mapboxgl-ctrl-group]:border-[#e7e0d8] [&_.mapboxgl-ctrl-group]:shadow-[0_2px_8px_rgb(34_38_41/18%)]",
          "[&_.mapboxgl-ctrl-group_button]:size-8.5 [&_.mapboxgl-ctrl-group_button]:bg-white [&_.mapboxgl-ctrl-group_button]:text-[#292624] [&_.mapboxgl-ctrl-group_button:hover]:bg-[#f4f8f7]",
          "[&_.mapboxgl-ctrl-attrib]:max-w-[min(70vw,390px)] [&_.mapboxgl-ctrl-attrib]:bg-white/92 [&_.mapboxgl-ctrl-attrib]:text-[10px] [&_.mapboxgl-ctrl-attrib]:text-[#46423e] [&_.mapboxgl-ctrl-attrib_a]:text-[#075985] [&_.mapboxgl-ctrl-attrib_a]:underline",
        ].join(" ")}
        role="region"
        aria-label="Bản đồ cơ sở y tế. Kéo để di chuyển, dùng nút thu phóng hoặc chọn một ghim để xem thông tin."
      />
      <p className="flex flex-none flex-wrap items-center gap-2.5 bg-white px-3.25 py-2.75 text-[11px]">
        <span className="inline-block size-2.5 rounded-full bg-[#bf2b2f]" /> {placeLabel} <span className="ml-3 inline-block size-2.5 rounded-full bg-[#2563eb]" /> Vị trí của bạn
        {routes.length > 0 && (
          <>
            <span className="ml-3 inline-block h-1 w-4 rounded-full bg-[#1a73e8]" /> Tuyến đang chọn
            {routes.length > 1 && <><span className="ml-3 inline-block h-1 w-4 rounded-full bg-[#9aa0a6]" /> Tuyến khác</>}
          </>
        )}
      </p>
      {failed && (
        <p className="my-3 px-3.5 text-[13px] leading-[1.7] text-[#942025]" role="status">
          {TOKEN
            ? "Bản đồ chưa tải được. Bạn vẫn có thể xem địa chỉ và gọi từ danh sách. "
            : "Chưa cấu hình NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN nên chưa hiện bản đồ. Danh sách bên dưới vẫn dùng được. "}
          {TOKEN && (
            <button type="button" className="min-h-11 cursor-pointer px-3 py-1 underline" onClick={() => { setFailed(false); setRetry((value) => value + 1); }}>
              Tải lại bản đồ
            </button>
          )}
        </p>
      )}
    </div>
  );
}
