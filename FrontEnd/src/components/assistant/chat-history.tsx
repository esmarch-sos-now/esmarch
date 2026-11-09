"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { Line } from "@/hooks/useVoiceCall";

/** The conversation so far, as the transcript of what was said (kept in this tab only). */
export default function ChatHistory({ lines, handoff, open, onClose }: { lines: Line[]; handoff: string; open: boolean; onClose: () => void }) {
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll the list itself: scrollIntoView would also scroll the clipped page frame sideways and push the stage off-screen.
    const el = list.current;
    if (el && open) el.scrollTop = el.scrollHeight;
  }, [lines, open]);

  return (
    <aside className="fa-history" data-open={open} aria-hidden={!open} inert={!open}>
      <div className="fa-history-head">
        <h2>Lịch sử trò chuyện</h2>
        <button type="button" className="fa-icon" onClick={onClose} aria-label="Đóng lịch sử">
          <X aria-hidden="true" />
        </button>
      </div>
      <div className="fa-history-list" ref={list}>
        {handoff && (
          <section className="fa-handoff" aria-label="Thông tin bàn giao">
            <h2>Thông tin bàn giao cho nhân viên y tế</h2>
            <p>{handoff}</p>
          </section>
        )}
        {lines.length === 0 ? (
          <p className="fa-history-empty">Chưa có nội dung nào.</p>
        ) : (
          lines.map((line) => (
            <p key={line.key} className="fa-line" data-speaker={line.speaker}>
              <span>{line.speaker === "user" ? "Bạn" : "Trợ lý"}</span>
              {line.text}
            </p>
          ))
        )}
      </div>
    </aside>
  );
}
