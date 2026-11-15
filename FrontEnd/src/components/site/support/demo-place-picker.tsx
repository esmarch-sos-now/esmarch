"use client";

import { DEMO_LOCATION_ENABLED, DEMO_PLACES } from "@/hooks/useLivePosition";

// Demo only (NEXT_PUBLIC_DEMO_LOCATION=true): pick where this tab pretends to be.
export default function DemoPlacePicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  if (!DEMO_LOCATION_ENABLED) return null;
  return (
    <label className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-[#c9a400] bg-[#fffbea] px-3 py-2 text-[13px] text-[#6b5500]">
      <span className="font-semibold">Demo · vị trí giả lập:</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-md border border-[#e6d27a] bg-white px-2 py-1 text-[13px] text-ink"
      >
        <option value="">Vị trí thật (GPS)</option>
        {DEMO_PLACES.map((place) => (
          <option key={place.id} value={place.id}>{place.label}</option>
        ))}
      </select>
    </label>
  );
}
