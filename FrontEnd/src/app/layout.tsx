import type { Metadata } from "next";
import type { ReactNode } from "react";
import { inter } from "@/components/site/landing/inter";
import "./globals.css";

// Inter is the only font: font-sans, font-heading, font-display and font-number all point to --font-inter (globals.css).

export const metadata: Metadata = {
  title: "SOS NOW — ESMARCH",
  description: "Hỗ trợ sơ cứu và tìm cơ sở y tế gần nhất.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" className={inter.variable} data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
