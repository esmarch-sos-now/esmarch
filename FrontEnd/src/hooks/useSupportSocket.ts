"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supportSocketUrl } from "@/lib/support/protocol";

// One live connection to /api/support/ws ("Tìm kiếm người hỗ trợ").
// - Opens, sends the `hello` the caller builds (a fresh one-time ticket for responders, the requester token otherwise).
// - Keeps the socket alive with a ping every 20 s and reconnects after drops: 1 s, 2 s, 4 s … up to 15 s.
// - If the socket cannot be opened three times in a row it falls back to polling: `poll()` runs every 3 s and a new
//   socket attempt is made every 30 s, so a demo keeps working behind a proxy or tunnel without WebSockets.
// - A policy close (1008: bad ticket, unknown request) is final: `onRejected` runs and nothing reconnects.

export type SocketStatus = "idle" | "connecting" | "open" | "reconnecting" | "polling" | "closed";

type Options<M> = {
  enabled: boolean;
  /** Builds the hello message; null = cannot authenticate now (stays idle). */
  hello: () => Promise<Record<string, unknown> | null>;
  onMessage: (message: M) => void;
  /** HTTP fallback while the socket is down. */
  poll: () => Promise<void>;
  onRejected?: (reason: string) => void;
};

const PING_MS = 20_000;
const POLL_MS = 3_000;
const RETRY_FROM_POLLING_MS = 30_000;
const FAILURES_BEFORE_POLLING = 3;

export function useSupportSocket<M extends { type: string }>({ enabled, hello, onMessage, poll, onRejected }: Options<M>) {
  const [status, setStatus] = useState<SocketStatus>("idle");
  const socket = useRef<WebSocket | null>(null);
  const handlers = useRef({ hello, onMessage, poll, onRejected });

  useEffect(() => {
    handlers.current = { hello, onMessage, poll, onRejected };
  });

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let failures = 0;
    let attempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let pingTimer: ReturnType<typeof setInterval> | undefined;
    let pollTimer: ReturnType<typeof setInterval> | undefined;

    const stopPolling = () => {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = undefined;
    };
    const startPolling = () => {
      setStatus("polling");
      if (!pollTimer) {
        void handlers.current.poll().catch(() => undefined);
        pollTimer = setInterval(() => void handlers.current.poll().catch(() => undefined), POLL_MS);
      }
      retryTimer = setTimeout(connect, RETRY_FROM_POLLING_MS);
    };

    async function connect() {
      if (stopped) return;
      setStatus((current) => (current === "polling" ? "polling" : attempt === 0 ? "connecting" : "reconnecting"));
      const message = await handlers.current.hello().catch(() => null);
      if (stopped) return;
      if (!message) {
        setStatus("idle");
        return;
      }
      let opened = false;
      let ws: WebSocket;
      try {
        ws = new WebSocket(supportSocketUrl());
      } catch {
        return onFailure(false);
      }
      socket.current = ws;
      ws.onopen = () => {
        opened = true;
        ws.send(JSON.stringify(message));
      };
      ws.onmessage = (event) => {
        let data: M;
        try {
          data = JSON.parse(String(event.data)) as M;
        } catch {
          return;
        }
        if (data.type === "ready" || data.type === "request.state") {
          failures = 0;
          attempt = 0;
          stopPolling();
          setStatus("open");
          if (pingTimer) clearInterval(pingTimer);
          pingTimer = setInterval(() => ws.readyState === WebSocket.OPEN && ws.send('{"type":"ping"}'), PING_MS);
        }
        if (data.type !== "pong") handlers.current.onMessage(data);
      };
      ws.onclose = (event) => {
        if (pingTimer) clearInterval(pingTimer);
        if (socket.current === ws) socket.current = null;
        if (stopped) return;
        if (event.code === 1008) {
          stopPolling();
          setStatus("closed");
          handlers.current.onRejected?.(event.reason);
          return;
        }
        onFailure(opened);
      };
    }

    function onFailure(wasOpen: boolean) {
      if (stopped) return;
      failures = wasOpen ? 0 : failures + 1;
      attempt += 1;
      if (failures >= FAILURES_BEFORE_POLLING) return startPolling();
      setStatus(pollTimer ? "polling" : "reconnecting");
      retryTimer = setTimeout(connect, Math.min(15_000, 1000 * 2 ** Math.min(attempt - 1, 4)));
    }

    void connect();
    return () => {
      stopped = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (pingTimer) clearInterval(pingTimer);
      stopPolling();
      socket.current?.close(1000);
      socket.current = null;
      setStatus("idle");
    };
  }, [enabled]);

  /** Sends over the socket; false when it is not open (the caller then uses the HTTP fallback). */
  const send = useCallback((message: Record<string, unknown>) => {
    const ws = socket.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(message));
    return true;
  }, []);

  return { status, send };
}
