"use client";

import { useRouter } from "next/navigation";
import { Phone } from "lucide-react";
import Navbar from "@/components/site/landing/Navbar";
import { appNav, sosScreen } from "@/content/app";

// Màn hình Nút SOS: nhấn nút chuyển sang màn Cơ sở y tế gần nhất và mở hộp Gọi 115 / Hủy (bản demo không gọi thật)
export default function SosScreen() {
  const router = useRouter();

  return (
    <div className="page">
      <Navbar appLinks={appNav} />
      <main className="sos-screen">
        <h1 className="sos-screen-question">{sosScreen.question}</h1>
        <p className="sos-screen-hint">{sosScreen.hint}</p>

        <div className="sos-screen-stage">
          <span className="sos-screen-ring" aria-hidden="true" />
          <span className="sos-screen-ring sos-screen-ring-2" aria-hidden="true" />
          <span className="sos-screen-ring sos-screen-ring-3" aria-hidden="true" />
          {/* ?sos=1 opens the call dialog on the facilities screen (no coordinates in the URL) */}
          <button type="button" className="sos-screen-button" onClick={() => router.push("/app/co-so-y-te?sos=1")} aria-label={sosScreen.buttonLabel}>{sosScreen.button}</button>
        </div>

        <p className="sos-screen-cta"><Phone aria-hidden="true" /> {sosScreen.buttonLabel}</p>
        <p className="sos-screen-note">{sosScreen.note}</p>
      </main>
    </div>
  );
}
