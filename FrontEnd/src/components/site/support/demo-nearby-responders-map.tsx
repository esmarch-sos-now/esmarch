"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Phone, UserRound } from "lucide-react";
import DemoCallFlow from "@/components/site/support/demo-call-flow";
import { formatDistance } from "@/content/facilities";
import type { Point } from "@/lib/api/hooks";
import { getNearestDemoResponders, type DemoResponder } from "@/lib/support/demo-responders";

const MapCanvas = dynamic(() => import("./demo-nearby-responders-map-canvas"), {
  ssr: false,
  loading: () => <div className="grid h-full min-h-[340px] place-items-center bg-[#e8efe8] text-sm text-muted-foreground">Đang mở bản đồ demo…</div>,
});

export default function DemoNearbyRespondersMap({ center }: { center: Point }) {
  const nearestResponders = getNearestDemoResponders(center, 20);
  // Demo only: no real call is placed; picking a supporter opens the connecting -> connected screens.
  const [calling, setCalling] = useState<DemoResponder | null>(null);

  if (calling) return <DemoCallFlow center={center} responder={calling} onBack={() => setCalling(null)} />;

  return (
    <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(250px,.95fr)]">
      <figure className="min-w-0 overflow-hidden rounded-2xl border border-line bg-white" aria-label="Bản đồ demo người hỗ trợ quanh bạn">
        <div className="relative h-[clamp(340px,55svh,520px)] w-full">
          <MapCanvas center={center} />
          <p className="absolute top-3 left-3 z-10 rounded-full border border-emerald-200 bg-white/95 px-3 py-1.5 text-xs font-bold text-emerald-800 shadow-sm">
            20 người đang sẵn sàng giúp
          </p>
        </div>
        <figcaption className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 text-xs text-ink">
          <span className="inline-flex items-center gap-2"><span className="size-3 rounded-full bg-emerald-600" /> Người hỗ trợ mô phỏng</span>
          <span className="inline-flex items-center gap-2"><span className="size-3 rounded-full bg-blue-600" /> Vị trí hiện tại</span>
        </figcaption>
      </figure>

      <aside className="flex h-[calc(clamp(340px,55svh,520px)+56px)] min-w-0 flex-col rounded-2xl border border-line bg-white p-4 sm:p-5" aria-labelledby="nearest-responders-title">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="nearest-responders-title" className="text-lg leading-tight font-bold text-ink">Người hỗ trợ gần bạn</h2>
            <p className="mt-1 text-sm text-muted-foreground">Sẵn sàng hỗ trợ quanh bạn</p>
          </div>
          <span className="shrink-0 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-bold text-brand">GẦN BẠN</span>
        </div>

        <ol className="mt-5 grid min-h-0 flex-1 content-start gap-3 overflow-y-auto pr-1" aria-label="Danh sách người hỗ trợ gần nhất, cuộn để chọn người khác">
          {nearestResponders.map((responder, index) => (
            <li key={responder.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-line bg-[#fffdfc] p-3">
              <span className="relative grid size-10 shrink-0 place-items-center" aria-hidden="true">
                <span className="absolute inset-0 rounded-full bg-[rgba(234,84,85,.14)] animate-sos-wave motion-reduce:animate-none motion-reduce:opacity-50" />
                <span className="absolute inset-0 rounded-full bg-[rgba(234,84,85,.14)] animate-sos-wave [animation-delay:.85s] motion-reduce:animate-none motion-reduce:opacity-50" />
                <span className="relative grid size-8 place-items-center rounded-full bg-emerald-600 text-white shadow-sm">
                  <UserRound className="size-4" strokeWidth={2.5} />
                </span>
                <span className="absolute -right-1 -bottom-1 grid size-4 place-items-center rounded-full border border-white bg-brand text-[9px] font-bold text-white">{index + 1}</span>
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-ink">Người hỗ trợ {responder.id}</span>
                <span className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                  <span className="size-1.5 animate-pulse rounded-full bg-emerald-600 motion-reduce:animate-none" />
                  Sẵn sàng
                </span>
              </span>

              <span className="shrink-0 text-right">
                <span className="block text-sm font-bold tabular-nums text-ink">{formatDistance(responder.distanceMeters)}</span>
                <span className="text-[11px] text-muted-foreground">cách bạn</span>
              </span>

              <button
                type="button"
                onClick={() => setCalling(responder)}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-brand px-3 text-xs font-bold text-white transition-colors hover:bg-brand-dark"
              >
                <Phone aria-hidden="true" className="size-3.5" />
                Gọi ngay
              </button>
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}
