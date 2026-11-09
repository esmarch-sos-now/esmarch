import type { ReactNode } from "react";
import { SWRProvider } from "@/components/providers/swr-provider";
import "mapbox-gl/dist/mapbox-gl.css";
import "@/styles/site/tokens.css";
import "@/styles/site/landing.css";
import "@/styles/site/problem.css";
import "@/styles/site/features.css";
import "@/styles/site/pricing.css";
import "@/styles/site/team.css";
import "@/styles/site/faq.css";
import "@/styles/site/cta-footer.css";
import "@/styles/site/app.css";
import "@/styles/site/sos.css";
import "@/styles/site/voice.css";
import "@/styles/site/assistant.css";
import "@/styles/site/facilities-page.css";
import "@/styles/site/map.css";

export default function SiteLayout({ children }: { children: ReactNode }) {
  return <SWRProvider>{children}</SWRProvider>;
}
