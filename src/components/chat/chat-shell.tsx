"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ConversationList } from "./conversation-list";
import { MessagePane } from "./message-pane";
import { useChatSocket } from "./use-chat-socket";
import type { ChannelSummary, ChatUser, ConversationListItem } from "./types";
import type { ChatEvent } from "@/lib/chat/events";
import { openDmAction } from "@/app/(dashboard)/chat/actions";

export function ChatShell({
  currentUser,
  isAdmin,
  initialConversations,
  allChannels,
  orgUsers,
}: {
  currentUser: ChatUser;
  isAdmin: boolean;
  initialConversations: ConversationListItem[];
  allChannels: ChannelSummary[];
  orgUsers: ChatUser[];
}) {
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(initialConversations[0]?.id ?? null);

  const { data: onlineData } = useQuery({
    queryKey: ["chat-online"],
    queryFn: async (): Promise<Set<string>> => {
      const res = await fetch("/api/chat/online");
      if (!res.ok) throw new Error(`Failed to load online status (${res.status})`);
      const json = await res.json();
      return new Set<string>(json.onlineUserIds);
    },
    refetchInterval: 20_000,
  });
  const onlineUserIds = onlineData ?? new Set<string>();

  const { data: conversations } = useQuery({
    queryKey: ["chat-conversations"],
    queryFn: async (): Promise<ConversationListItem[]> => {
      const res = await fetch("/api/chat/conversations");
      if (!res.ok) throw new Error(`Failed to load conversations (${res.status})`);
      const json = await res.json();
      return json.conversations;
    },
    initialData: initialConversations,
    refetchInterval: 20_000,
  });

  const handleSocketEvent = useCallback(
    (event: ChatEvent) => {
      // Sidebar list (unread counts, last-message preview) changes shape on
      // every event type but is a small array — cheap enough to just refetch.
      // The message list itself is the hot path (can be hundreds of rows on
      // a busy channel), so MessagePane patches its own cache in place
      // instead of refetching here; this handler only ever touches the
      // sidebar + unread badge, never ["chat-messages", ...].
      if (event.type !== "typing") {
        queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
        queryClient.invalidateQueries({ queryKey: ["chat-unread"] });
      }
    },
    [queryClient],
  );

  const wsStatus = useChatSocket(handleSocketEvent);

  const activeConversation = useMemo(() => conversations?.find((c) => c.id === activeId) ?? null, [conversations, activeId]);

  const handleOpenDm = useCallback(
    async (userId: string) => {
      try {
        const { conversationId } = await openDmAction(userId);
        await queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
        setActiveId(conversationId);
      } catch {
        toast.error("Couldn't open that conversation.");
      }
    },
    [queryClient],
  );

  useEffect(() => {
    if (!activeId && conversations && conversations.length > 0) setActiveId(conversations[0].id);
  }, [activeId, conversations]);

  return (
    <div className="flex h-[calc(100dvh-1px)] min-h-0">
      <ConversationList
        conversations={conversations ?? []}
        activeId={activeId}
        onSelect={setActiveId}
        isAdmin={isAdmin}
        allChannels={allChannels}
        orgUsers={orgUsers}
        onOpenDm={handleOpenDm}
        wsStatus={wsStatus}
        onlineUserIds={onlineUserIds}
      />
      <MessagePane
        key={activeConversation?.id ?? "empty"}
        conversation={activeConversation}
        currentUser={currentUser}
        isAdmin={isAdmin}
        orgUsers={orgUsers}
      />
    </div>
  );
}
