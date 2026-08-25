"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatEvent } from "@/lib/chat/events";

export type ChatSocketStatus = "connecting" | "open" | "closed";

const RECONNECT_DELAY_MS = 2000;

/**
 * One shared WebSocket connection for the whole chat surface — events for
 * every conversation the user can see arrive on this single socket (the
 * chat-ws relay already filters server-side by access), so switching
 * threads never means opening a new connection.
 */
export function useChatSocket(onEvent: (event: ChatEvent) => void) {
  const [status, setStatus] = useState<ChatSocketStatus>("connecting");
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_CHAT_WS_URL;
    if (!url) {
      setStatus("closed");
      return;
    }

    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    function connect() {
      if (cancelled) return;
      setStatus("connecting");
      socket = new WebSocket(url!);

      socket.onopen = () => setStatus("open");
      socket.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as ChatEvent;
          onEventRef.current(parsed);
        } catch {
          // Ignore malformed frames.
        }
      };
      socket.onclose = () => {
        setStatus("closed");
        if (!cancelled) reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
      };
      socket.onerror = () => socket?.close();
    }

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, []);

  return status;
}
