import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Anton, Geist, Sigmar } from "next/font/google";
import { cn } from "@/lib/utils";
import "./globals.css";

// Geist is the UI font (font-sans); Sigmar (font-display) and Anton (font-number) are brand display faces.
const geist = Geist({ subsets: ["latin", "vietnamese"], variable: "--font-geist" });
const sigmar = Sigmar({ subsets: ["latin", "vietnamese"], weight: "400", variable: "--font-sigmar" });
const anton = Anton({ subsets: ["latin", "vietnamese"], weight: "400", variable: "--font-anton" });

export const metadata: Metadata = {
  title: "SOS NOW — ESMARCH",
  description: "Hỗ trợ sơ cứu và tìm cơ sở y tế gần nhất.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" className={cn(geist.variable, sigmar.variable, anton.variable)}>
      <body>{children}</body>
    </html>
  );
}
