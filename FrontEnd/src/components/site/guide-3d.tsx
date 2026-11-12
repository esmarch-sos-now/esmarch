import Link from "next/link";
import { ArrowLeft, Maximize2, Phone } from "lucide-react";
import Navbar from "@/components/site/landing/Navbar";
import { appNav } from "@/content/app";

// Màn hình hướng dẫn 3D: nhúng file HTML độc lập vào khung sandbox (chỉ cho chạy script,
// không cho truy cập trang chính), kèm thanh quay lại và nút gọi 115
export default function Guide3D({ title, file }: { title: string; file: string }) {
  return (
    <div className="flex h-svh w-full max-w-screen flex-col overflow-hidden bg-paper">
      <Navbar appLinks={appNav} />
      <div className="flex min-w-0 flex-none items-center gap-3 border-b border-line bg-paper px-4 py-2.5 [&_svg]:size-4">
        <Link className="inline-flex flex-none items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-brand max-xs:text-[13px]" href="/app/sos">
          <ArrowLeft aria-hidden="true" /> Quay lại
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-center text-[17px] leading-[1.3] font-black text-ink max-xs:text-[15px]">{title}</h1>
        {/* Mở riêng file 3D khi khung nhúng bị chặn hoặc muốn xem toàn màn hình */}
        <a className="grid size-9 flex-none place-items-center rounded-full bg-[#f1f1f1] text-ink hover:text-brand" href={file} target="_blank" rel="noreferrer" aria-label="Mở toàn màn hình">
          <Maximize2 aria-hidden="true" />
        </a>
        <a className="inline-flex flex-none items-center gap-1.5 rounded-full bg-brand px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-dark max-xs:text-[13px]" href="tel:115">
          <Phone aria-hidden="true" /> Gọi 115
        </a>
      </div>
      <iframe className="min-h-0 w-full min-w-0 flex-1 border-0 bg-[#e6ebf0]" src={file} title={title} sandbox="allow-scripts" allow="fullscreen" />
    </div>
  );
}
