import Link from "next/link";
import { ArrowLeft, Maximize2, Phone } from "lucide-react";
import Navbar from "@/components/site/landing/Navbar";
import { appNav } from "@/content/app";

// Màn hình hướng dẫn 3D: nhúng file HTML độc lập vào khung sandbox (chỉ cho chạy script,
// không cho truy cập trang chính), kèm thanh quay lại và nút gọi 115
export default function Guide3D({ title, file }: { title: string; file: string }) {
  return (
    <div className="page guide3d">
      <Navbar appLinks={appNav} />
      <div className="guide3d-bar">
        <Link className="guide3d-back" href="/app/sos"><ArrowLeft aria-hidden="true" /> Quay lại</Link>
        <h1 className="guide3d-title">{title}</h1>
        {/* Mở riêng file 3D khi khung nhúng bị chặn hoặc muốn xem toàn màn hình */}
        <a className="guide3d-open" href={file} target="_blank" rel="noreferrer" aria-label="Mở toàn màn hình"><Maximize2 aria-hidden="true" /></a>
        <a className="guide3d-call" href="tel:115"><Phone aria-hidden="true" /> Gọi 115</a>
      </div>
      <iframe className="guide3d-frame" src={file} title={title} sandbox="allow-scripts" allow="fullscreen" />
    </div>
  );
}
