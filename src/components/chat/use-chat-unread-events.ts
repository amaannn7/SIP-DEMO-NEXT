"use client";

import { useChatSocket } from "./use-chat-socket";
import type { ChatEvent } from "@/lib/chat/events";

/** Fires the callback whenever a new message arrives anywhere the socket is scoped to — used to refresh unread badges without handling the full event shape. */
export function useChatUnreadEvents(onNewMessage: () => void) {
  useChatSocket((event: ChatEvent) => {
    if (event.type === "message") onNewMessage();
  });
}
