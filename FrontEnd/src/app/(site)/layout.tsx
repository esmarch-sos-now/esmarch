import type { ReactNode } from "react";
import { SWRProvider } from "@/components/providers/swr-provider";
import "mapbox-gl/dist/mapbox-gl.css";

export default function SiteLayout({ children }: { children: ReactNode }) {
  return <SWRProvider>{children}</SWRProvider>;
}
