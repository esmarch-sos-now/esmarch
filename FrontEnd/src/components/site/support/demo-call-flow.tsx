"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, PhoneCall } from "lucide-react";
import PointMap from "@/components/site/support/point-map";
import { Button } from "@/components/ui/button";
import { formatDistance } from "@/content/facilities";
import type { Point } from "@/lib/api/hooks";
import { formatDuration, useDirections } from "@/lib/directions";
import type { DemoResponder } from "@/lib/support/demo-responders";

const CONNECT_DELAY_MS = 3000;

// Demo only: no real call is placed. "Connecting" fakes a short wait, then shows the supporter's road to the user.
export default function DemoCallFlow({ center, responder, onBack }: { center: Point; responder: DemoResponder; onBack: () => void }) {
  const [connected, setConnected] = useState(false);
  const name = `Người hỗ trợ ${responder.id}`;

  useEffect(() => {
    const timer = setTimeout(() => setConnected(true), CONNECT_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  const directions = useDirections(connected ? responder.point : null, connected ? center : null, "motorbike");
  const routes = directions.data ?? [];
  const route = routes[0];

  if (!connected) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-line bg-white px-5 py-14 text-center" role="status" aria-live="polite">
        <span className="relative grid size-20 place-items-center" aria-hidden="true">
          <span className="absolute inset-0 rounded-full bg-[rgba(234,84,85,.14)] animate-sos-wave motion-reduce:animate-none" />
          <span className="absolute inset-0 rounded-full bg-[rgba(234,84,85,.14)] animate-sos-wave [animation-delay:.85s] motion-reduce:animate-none" />
          <span className="relative grid size-14 place-items-center rounded-full bg-brand text-white shadow-md">
            <Loader2 className="size-7 animate-spin motion-reduce:animate-none" />
          </span>
        </span>
        <h2 className="mt-6 text-2xl font-black text-ink">Đợi xíu, mình đang liên hệ người giúp nha.</h2>
        <p className="mt-2 text-sm text-muted-foreground">Đang gọi {name} · cách bạn {formatDistance(responder.distanceMeters)}</p>
        <Button variant="outline" onClick={onBack} className="mt-6 rounded-full"><ArrowLeft aria-hidden="true" /> Chọn người khác</Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(280px,380px)_minmax(0,1fr)]" aria-live="polite">
      <div className="flex flex-col rounded-2xl border-2 border-[#1a73e8] bg-white p-4.5">
        <p className="inline-flex items-center gap-1.5 text-xs font-bold tracking-wide text-[#1a73e8] uppercase"><PhoneCall aria-hidden="true" className="size-3.5" /> Đã kết nối</p>
        <h2 className="mt-1 text-2xl leading-tight font-black text-ink">{name} đang tới chỗ bạn</h2>
        {directions.isLoading && <p className="mt-2 text-sm text-muted-foreground">Đang tìm đường đi…</p>}
        {directions.error && <p className="mt-2 text-sm text-[#942025]">{directions.error.message}</p>}
        <dl className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-[#f6f9fe] p-3">
            <dt className="text-xs font-semibold text-muted-foreground">Thời gian đến</dt>
            <dd className="mt-1 text-2xl font-black text-[#1a73e8] tabular-nums">{route ? formatDuration(route.duration) : "—"}</dd>
          </div>
          <div className="rounded-xl bg-[#f6f9fe] p-3">
            <dt className="text-xs font-semibold text-muted-foreground">{route ? "Quãng đường" : "Đường chim bay"}</dt>
            <dd className="mt-1 text-2xl font-black text-ink tabular-nums">{formatDistance(route ? route.distance : responder.distanceMeters)}</dd>
          </div>
        </dl>
        <Button variant="outline" onClick={onBack} className="mt-4 self-start rounded-full lg:mt-auto"><ArrowLeft aria-hidden="true" /> Chọn người khác</Button>
      </div>
      {/* Sized to the viewport (minus navbar + page heading) so the whole connected screen fits without scrolling */}
      <PointMap me={center} other={responder.point} label={name} routes={routes} activeRoute={0} className="h-[clamp(300px,calc(100svh-360px),680px)]" />
    </div>
  );
}
