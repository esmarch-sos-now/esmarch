"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Live updates for "Tìm kiếm người hỗ trợ" without a server WebSocket.
// The backend sends a tiny "changed" signal over a Supabase Realtime Broadcast channel (`support:responder:<id>` or
// `support:request:<id>`) whenever something changes; it carries no personal data. On every signal the screen
// refetches over authenticated HTTP (`refresh`). The channel can drop or be unavailable, so `refresh` also runs on a
// timer: every 3 s while the channel is not subscribed (works behind any proxy), every 20 s as a safety net otherwise.

export type ChannelStatus = "idle" | "connecting" | "open" | "polling";

type Options = {
  enabled: boolean;
  /** `support:responder:<user id>` or `support:request:<request id>`; null = nothing to listen to yet. */
  topic: string | null;
  /** Called with the signal type (e.g. "request.taken") before the refetch, so the screen can show a notice. */
  onSignal?: (type: string) => void;
  /** Refetch the current view over HTTP. */
  refresh: () => Promise<void>;
};

const POLL_MS = 3_000;
const SAFETY_POLL_MS = 20_000;

export function useSupportChannel({ enabled, topic, onSignal, refresh }: Options) {
  const [status, setStatus] = useState<ChannelStatus>("idle");
  const handlers = useRef({ onSignal, refresh });

  useEffect(() => {
    handlers.current = { onSignal, refresh };
  });

  useEffect(() => {
    if (!enabled || !topic) return;
    let stopped = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    const run = () => void handlers.current.refresh().catch(() => undefined);
    const poll = (ms: number) => {
      if (timer) clearInterval(timer);
      timer = setInterval(run, ms);
    };

    run();
    poll(POLL_MS);
    const supabase = createClient();
    const channel = supabase
      .channel(topic)
      .on("broadcast", { event: "changed" }, ({ payload }) => {
        const type = typeof payload?.type === "string" ? payload.type : "";
        if (type) handlers.current.onSignal?.(type);
        run();
      })
      .subscribe((state) => {
        if (stopped) return;
        if (state === "SUBSCRIBED") {
          setStatus("open");
          poll(SAFETY_POLL_MS);
          run(); // anything that changed before the subscription was live
        } else {
          setStatus("polling");
          poll(POLL_MS);
        }
      });

    return () => {
      stopped = true;
      if (timer) clearInterval(timer);
      void supabase.removeChannel(channel);
      setStatus("idle");
    };
  }, [enabled, topic]);

  return { status: enabled && topic && status === "idle" ? ("connecting" as const) : status };
}
