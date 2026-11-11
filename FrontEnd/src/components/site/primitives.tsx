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
