"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Maximize2, Mic, MicOff, Phone, Volume2 } from "lucide-react";
import { stepVoice } from "@/content/app";
import { useStepCommands, type CommandStatus, type HeardCommand } from "@/hooks/useStepCommands";
import { cn } from "@/lib/utils";

// Màn hình hướng dẫn 3D: nhúng file HTML độc lập vào khung sandbox (chỉ cho chạy script,
// không cho truy cập trang chính), kèm thanh quay lại và nút gọi 115. Không có thanh điều hướng của app,
// để hình và các nút bước chiếm trọn màn hình; "Quay lại" đưa về màn chọn tình huống.
// ?voice=1 bật giọng đọc thu sẵn trong khung và đọc bước 1 ngay (cú chạm mở trang cho phép phát âm thanh).
// Lệnh giọng nói ("xong", "nhắc lại", "quay lại", "gọi 115") chuyển bước ngay trong trình duyệt (useStepCommands).
export default function Guide3D({ title, file }: { title: string; file: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const commands = useStepCommands(frame);
  return (
    <div className="flex h-svh w-full max-w-screen flex-col overflow-hidden bg-paper">
      <div className="flex min-w-0 flex-none items-center gap-3 border-b border-line bg-paper px-4 py-2.5 [&_svg]:size-4">
        <Link className="inline-flex flex-none items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-brand max-xs:text-[13px]" href="/app/huong-dan">
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
      <CommandBar status={commands.status} heard={commands.heard} onToggle={commands.toggle} />
      <iframe ref={frame} className="min-h-0 w-full min-w-0 flex-1 border-0 bg-[#e6ebf0]" src={`${file}?voice=1`} title={title} sandbox="allow-scripts" allow="autoplay; fullscreen" />
    </div>
  );
}

const HEARD_MS = 2000;

// Thanh mỏng dưới tiêu đề: micro đang nghe hay đang tạm dừng vì hướng dẫn đang đọc, và lệnh vừa nghe được
function CommandBar({ status, heard, onToggle }: { status: CommandStatus; heard: HeardCommand | null; onToggle: () => void }) {
  const [shown, setShown] = useState<HeardCommand | null>(null);
  useEffect(() => {
    if (!heard) return;
    const show = setTimeout(() => setShown(heard), 0);
    const hide = setTimeout(() => setShown(null), HEARD_MS);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [heard]);

  if (status === "unsupported") return null;
  const on = status !== "off";
  const Icon = status === "reading" ? Volume2 : on && status !== "denied" ? Mic : MicOff;
  const text = shown ? stepVoice.heard[shown.command] : stepVoice[status];
  return (
    <div className="flex min-w-0 flex-none items-center gap-2 border-b border-line bg-white px-4 py-2 text-[14px] [&_svg]:size-4" aria-live="polite">
      <span
        className={cn(
          "grid size-7 flex-none place-items-center rounded-full",
          status === "listening" ? "animate-sos-ring bg-brand text-white" : "bg-[#f1f1f1] text-muted-foreground",
        )}
      >
        <Icon aria-hidden="true" />
      </span>
      <span className={cn("min-w-0 flex-1 truncate", shown ? "font-bold text-brand" : "text-ink")}>{text}</span>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={on}
        className="flex-none cursor-pointer rounded-full border border-line px-3 py-1 text-[13px] font-semibold text-ink hover:border-brand hover:text-brand"
      >
        {on ? stepVoice.turnOff : stepVoice.turnOn}
      </button>
    </div>
  );
}
