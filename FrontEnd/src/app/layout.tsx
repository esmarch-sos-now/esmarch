import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "SOS NOW — ESMARCH",
  description: "Hỗ trợ sơ cứu và tìm cơ sở y tế gần nhất.",
  icons: { icon: "/favicon.svg" },
};

// The site's plain CSS is attached in the (site) route group layout.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
