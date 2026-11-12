import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// Shared layout pieces for the marketing site and app pages.

/** 1280px content column with the 16px page gutter. */
export function Container({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("mx-auto w-full max-w-7xl px-4", className)} {...props} />;
}

/** A landing section; scroll-margin keeps anchors clear of the sticky navbar. */
export function Section({ className, ...props }: ComponentProps<"section">) {
  return <section className={cn("scroll-mt-17 py-12 max-xs:py-8", className)} {...props} />;
}

/** Grey pill label above section titles. */
export function Pill({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn("inline-block rounded-full bg-[#dedede] px-6.5 py-1 text-base text-ink max-xs:px-5 max-xs:py-0.75 max-xs:text-sm", className)}
      {...props}
    />
  );
}

// ---- Landing redesign (1440 frame scaled by --u, stacks below the `lp` breakpoint) ----

/** Small grey label of the redesigned sections ("Vấn đề", "HDSD", "Về chúng tôi", ...). */
export function FramePill({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex h-[calc(36*var(--u))] items-center justify-center rounded-full bg-[#d1d0d0] px-[calc(24*var(--u))] text-[calc(20.9*var(--u))] leading-none text-[#1a1a1a] max-lp:h-8 max-lp:px-4.5 max-lp:text-base",
        className,
      )}
      {...props}
    />
  );
}

/** Content column of the redesign: 1440 frame wide, 81-unit side margins (20px gutter once stacked). */
export function FrameContainer({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("mx-auto w-[calc(1440*var(--u))] px-[calc(81*var(--u))] max-lp:w-auto max-lp:px-5", className)} {...props} />;
}

const handle = "absolute size-[calc(6*var(--u))] min-h-1 min-w-1 -translate-1/2 bg-[#55c182] max-lp:size-1.5";

/** Green "selected" box with four corner handles drawn around a word (decoration from the design). */
export function SelectionFrame({ className, children, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "relative flex items-center justify-center border-[max(1px,calc(1*var(--u)))] border-[#55c182] bg-[linear-gradient(115deg,rgba(85,193,130,.06)_0%,rgba(85,193,130,.22)_55%,rgba(85,193,130,.42)_100%)] max-lp:border",
        className,
      )}
      {...props}
    >
      {children}
      <i className={cn(handle, "top-0 left-0")} aria-hidden="true" />
      <i className={cn(handle, "top-0 left-full")} aria-hidden="true" />
      <i className={cn(handle, "top-full left-0")} aria-hidden="true" />
      <i className={cn(handle, "top-full left-full")} aria-hidden="true" />
    </span>
  );
}

/** Fade-and-rise when scrolled into view (see hooks/useInView). */
export function reveal(inView: boolean) {
  return cn(
    "transition-[opacity,translate] duration-700 ease-out motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none",
    inView ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0",
  );
}

/** Page shell for app screens: white page, full height. */
export function Page({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("min-h-screen bg-paper", className)} {...props} />;
}
