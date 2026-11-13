"use client";

// Small building blocks for the admin tables: tinted chips, a coloured initial mark, view tabs and the bulk bar.
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const tones = {
  violet: "bg-violet-50 text-violet-700",
  emerald: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  rose: "bg-rose-50 text-rose-700",
  sky: "bg-sky-50 text-sky-700",
  fuchsia: "bg-fuchsia-50 text-fuchsia-700",
  gray: "bg-zinc-100 text-zinc-600",
} as const;

export type Tone = keyof typeof tones;

export function Chip({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={cn("inline-flex h-5 items-center rounded-md px-1.5 text-xs font-medium whitespace-nowrap", tones[tone])}>
      {children}
    </span>
  );
}

const marks = [
  "from-rose-500 to-orange-400",
  "from-violet-500 to-fuchsia-400",
  "from-sky-500 to-cyan-400",
  "from-emerald-500 to-lime-400",
  "from-amber-500 to-yellow-300",
  "from-indigo-500 to-sky-400",
  "from-pink-500 to-rose-300",
];

/** A small gradient square with the name's first letter; the colour is stable per id. */
export function Mark({ id, name }: { id: string; name: string }) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  const letter = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center rounded-[5px] bg-linear-to-br text-[10px] font-bold text-white",
        marks[Math.abs(hash) % marks.length],
      )}
    >
      {letter}
    </span>
  );
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("vi-VN", { day: "numeric", month: "long", year: "numeric" });
}

/** The row of saved views above a table (like Technology / Marketplace / … in the reference). */
export function ViewTabs<T extends string>({
  views,
  value,
  onChange,
}: {
  views: { value: T; label: string; icon: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="tablist" className="flex items-center gap-1 overflow-x-auto">
      {views.map((view) => (
        <button
          key={view.value}
          type="button"
          role="tab"
          aria-selected={view.value === value}
          onClick={() => onChange(view.value)}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:bg-muted hover:text-foreground [&_svg]:size-4",
            view.value === value && "bg-muted font-medium text-foreground ring-1 ring-border",
          )}
        >
          {view.icon}
          {view.label}
        </button>
      ))}
    </div>
  );
}

/** Shown above the table while rows are selected. */
export function BulkBar({ label, children, onClear, clearLabel }: { label: string; children: ReactNode; onClear: () => void; clearLabel: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-4 py-2 text-sm">
      <span className="mr-1 font-medium">{label}</span>
      {children}
      <button type="button" className="ml-auto text-muted-foreground hover:text-foreground" onClick={onClear}>
        {clearLabel}
      </button>
    </div>
  );
}

/** Header cell text: small and muted, like the reference table. */
export const headCell = "h-10 text-[13px] font-medium text-muted-foreground";
