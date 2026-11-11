"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { Line } from "@/hooks/useVoiceCall";
import { cn } from "@/lib/utils";

/**
 * The conversation so far, as the transcript of what was said (kept in this tab only).
 * A drawer on the right; on wide screens during a guide (`docked`) it floats as a card beside the 3D stage.
 */
export default function ChatHistory({
  lines,
  handoff,
  open,
  docked,
  onClose,
}: {
  lines: Line[];
  handoff: string;
  open: boolean;
  docked: boolean;
  onClose: () => void;
}) {
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll the list itself: scrollIntoView would also scroll the clipped page frame sideways and push the stage off-screen.
    const el = list.current;
    if (el && open) el.scrollTop = el.scrollHeight;
  }, [lines, open]);

  return (
    <aside
      data-open={open}
      aria-hidden={!open}
      inert={!open}
      className={cn(
        "absolute inset-y-0 right-0 z-5 flex w-[min(100%,384px)] flex-col bg-[rgba(13,16,21,.92)] backdrop-blur-[20px] transition-[translate,visibility] duration-300 ease-out motion-reduce:transition-none",
        open ? "visible translate-x-0" : "invisible translate-x-full",
        docked &&
          "min-[900px]:top-37.5 min-[900px]:right-4 min-[900px]:bottom-22 min-[900px]:z-4 min-[900px]:w-[min(340px,36vw)] min-[900px]:rounded-[20px] min-[900px]:border min-[900px]:border-white/10",
        docked && !open && "min-[900px]:translate-x-[calc(100%+24px)]",
      )}
    >
      <div className="flex items-center justify-between pt-3.5 pr-4 pl-6">
        <h2 className="text-sm font-medium text-[#a1a1aa]">Lịch sử trò chuyện</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng lịch sử"
          className="grid size-11 cursor-pointer place-items-center rounded-full text-[#a1a1aa] hover:text-[#f4f4f5] [&_svg]:size-5"
        >
          <X aria-hidden="true" />
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-6 pt-4 pb-6" ref={list}>
        {handoff && (
          <section className="w-full max-w-155 border-l-2 border-[#e11d48] pl-3.5 text-left" aria-label="Thông tin bàn giao">
            <h2 className="text-xs font-bold tracking-[.08em] text-[#fb7185] uppercase">Thông tin bàn giao cho nhân viên y tế</h2>
            <p className="mt-1 text-sm leading-[1.55] text-[#e4e4e7]">{handoff}</p>
          </section>
        )}
        {lines.length === 0 ? (
          <p className="text-sm text-[#71717a]">Chưa có nội dung nào.</p>
        ) : (
          lines.map((line) => (
            <p key={line.key} data-speaker={line.speaker} className={cn("text-[15px] leading-normal", line.speaker === "user" ? "text-[#a5f3fc]" : "text-[#e4e4e7]")}>
              <span className="mb-0.5 block text-[11px] font-semibold tracking-[.08em] text-[#71717a] uppercase">{line.speaker === "user" ? "Bạn" : "Trợ lý"}</span>
              {line.text}
            </p>
          ))
        )}
      </div>
    </aside>
  );
}
