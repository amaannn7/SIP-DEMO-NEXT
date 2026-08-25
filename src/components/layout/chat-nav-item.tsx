"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare } from "lucide-react";
import { PillNavItem } from "@/components/shared/pill-nav-item";
import { useChatUnreadEvents } from "@/components/chat/use-chat-unread-events";

const POLL_INTERVAL_MS = 15_000;

function isChatActive(pathname: string): boolean {
  return pathname === "/chat" || pathname.startsWith("/chat/");
}

export function ChatNavItem() {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["chat-unread"],
    queryFn: async (): Promise<{ count: number }> => {
      const res = await fetch("/api/chat/unread");
      return res.json();
    },
    refetchInterval: POLL_INTERVAL_MS,
  });

  // Live-push refetch on any incoming message — the poll above is just the
  // fallback for a socket that's reconnecting or a backgrounded tab.
  useChatUnreadEvents(() => queryClient.invalidateQueries({ queryKey: ["chat-unread"] }));

  return <PillNavItem href="/chat" label="Team Chat" icon={MessageSquare} badge={data?.count} activeMatch={isChatActive} />;
}
