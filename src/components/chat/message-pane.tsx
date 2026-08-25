"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { Hash, Lock, Loader2, MessageSquare, Pin, X } from "lucide-react";
import { UserAvatar } from "./user-avatar";
import { MessageGroup } from "./message-group";
import { Composer } from "./composer";
import { useChatSocket } from "./use-chat-socket";
import { markConversationReadAction, togglePinAction } from "@/app/(dashboard)/chat/actions";
import type { ChatMessage, ChatUser, ConversationListItem } from "./types";
import type { ChatEvent } from "@/lib/chat/events";

type PinnedInfo = { id: string; body: string; senderName: string; pinnedByName: string | null };
type MessagesPage = { messages: ChatMessage[]; pinned: PinnedInfo | null };

export function MessagePane({
  conversation,
  currentUser,
  isAdmin,
  orgUsers,
}: {
  conversation: ConversationListItem | null;
  currentUser: ChatUser;
  isAdmin: boolean;
  orgUsers: ChatUser[];
}) {
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [optimisticMessages, setOptimisticMessages] = useState<ChatMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const typingTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);

  const conversationId = conversation?.id ?? null;

  // Every WS event carries enough data to patch the cached message list
  // directly — no event type here ever triggers a refetch. That matters on
  // a busy channel: the previous implementation invalidated (refetched) the
  // *entire* message list on every send/edit/delete/reaction/pin from
  // *anyone*, which meant one active conversation could fire a full
  // network round-trip per keystroke-adjacent event.
  //
  // Pages are oldest-first (page 0 = the initial/most-recent-50 fetch, each
  // subsequent page is older history loaded by scrolling up), so a live
  // event — always a just-now message in the *newest* window — is patched
  // into page 0 specifically rather than searched for across every page.
  const patchMessages = useCallback(
    (updater: (messages: ChatMessage[]) => ChatMessage[]) => {
      queryClient.setQueryData<InfiniteData<MessagesPage> | undefined>(["chat-messages", conversationId], (old) => {
        if (!old) return old;
        const pages = [...old.pages];
        pages[0] = { ...pages[0], messages: updater(pages[0].messages) };
        return { ...old, pages };
      });
    },
    [queryClient, conversationId],
  );

  const socketStatus = useChatSocket((event: ChatEvent) => {
    if (event.conversationId !== conversationId) return;
    if (event.type === "typing") {
      if (event.userId === currentUser.id) return;
      setTypingUsers((prev) => new Map(prev).set(event.userId, event.userName));
      const existingTimer = typingTimersRef.current.get(event.userId);
      if (existingTimer) clearTimeout(existingTimer);
      // No explicit "stopped typing" event — a typing signal that isn't
      // refreshed within this window is treated as stale and cleared.
      typingTimersRef.current.set(
        event.userId,
        setTimeout(() => {
          setTypingUsers((prev) => {
            const next = new Map(prev);
            next.delete(event.userId);
            return next;
          });
          typingTimersRef.current.delete(event.userId);
        }, 5000),
      );
      return;
    }
    if (event.type === "message") {
      setTypingUsers((prev) => {
        if (!prev.has(event.message.senderId)) return prev;
        const next = new Map(prev);
        next.delete(event.message.senderId);
        return next;
      });
      if (event.message.senderId === currentUser.id) return;
      patchMessages((messages) => (messages.some((m) => m.id === event.message.id) ? messages : [...messages, { ...event.message, reactions: [] }]));
      return;
    }
    if (event.type === "message_edited") {
      patchMessages((messages) => messages.map((m) => (m.id === event.messageId ? { ...m, body: event.body, editedAt: new Date().toISOString() } : m)));
      return;
    }
    if (event.type === "message_deleted") {
      patchMessages((messages) => messages.map((m) => (m.id === event.messageId ? { ...m, body: "", deletedAt: new Date().toISOString() } : m)));
      return;
    }
    if (event.type === "reaction") {
      patchMessages((messages) =>
        messages.map((m) => {
          if (m.id !== event.messageId) return m;
          const groups = m.reactions.map((r) => ({ ...r, userIds: [...r.userIds] }));
          const group = groups.find((r) => r.emoji === event.emoji);
          if (event.action === "added") {
            if (group) {
              if (!group.userIds.includes(event.userId)) group.userIds.push(event.userId);
            } else {
              groups.push({ emoji: event.emoji, userIds: [event.userId] });
            }
          } else if (group) {
            group.userIds = group.userIds.filter((id) => id !== event.userId);
          }
          return { ...m, reactions: groups.filter((r) => r.userIds.length > 0) };
        }),
      );
      return;
    }
    if (event.type === "pin") {
      // Pinning is exclusive (server unpins any previous pin) and the pinned
      // banner needs sender/pinner names the "pin" event doesn't carry — a
      // targeted refetch of just this one small query is simpler and cheap
      // enough here, unlike the full message list.
      queryClient.invalidateQueries({ queryKey: ["chat-messages", conversationId] });
      return;
    }
  });

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["chat-messages", conversationId],
    queryFn: async ({ pageParam }): Promise<MessagesPage> => {
      const qs = new URLSearchParams({ conversationId: conversationId! });
      if (pageParam) qs.set("before", pageParam);
      const res = await fetch(`/api/chat/messages?${qs}`);
      if (!res.ok) throw new Error(`Failed to load messages (${res.status})`);
      return res.json();
    },
    initialPageParam: undefined as string | undefined,
    // Each page's oldest message becomes the cursor for the *next* (older)
    // page. A short page (listMessages caps at 50) means history is
    // exhausted — undefined here is what tells useInfiniteQuery to stop.
    getNextPageParam: (lastPage) => (lastPage.messages.length < 50 ? undefined : lastPage.messages[0]?.createdAt),
    enabled: conversationId !== null,
    // Ports the source system's rtConnected fallback exactly (setInterval
    // polling every 3s while the realtime connection is down) — without
    // this, an already-open conversation only ever refreshed on a WS event,
    // so a dropped/reconnecting socket left it silently stale until the user
    // switched threads and back. Only the newest page needs this, but
    // refetchInterval re-runs every page's queryFn with its own pageParam,
    // which naturally keeps every already-loaded page in place.
    refetchInterval: socketStatus === "open" ? false : 3000,
  });

  const pinned = data?.pages[0]?.pinned ?? null;

  const messages = useMemo(() => {
    // pages[0] is newest (most recently fetched, always the current tail of
    // the conversation); each subsequent page is older history — so the
    // rendered, oldest-first list is pages reversed, each page's own
    // contents already oldest-first internally (listMessages reverses its
    // own desc-order DB query before returning).
    const serverMessages = data ? [...data.pages].reverse().flatMap((p) => p.messages) : [];
    const serverIds = new Set(serverMessages.map((m) => m.id));
    // A pending optimistic entry's temp id (`pending-<timestamp>`) never
    // equals the real server-assigned UUID, so id-only dedup can't catch it
    // the instant its real counterpart lands — for one render both the
    // optimistic row and the freshly-fetched real row exist together with
    // different React keys, which mounts a second row before handleSent's
    // separate, later setOptimisticMessages call removes the first. Content
    // match (same sender + same body, landed within the last few seconds)
    // closes that gap in the same render pass instead of relying on two
    // independent async state updates to land in the right order.
    const recentServerSignatures = new Set(
      serverMessages
        .filter((m) => Date.now() - new Date(m.createdAt).getTime() < 15_000)
        .map((m) => `${m.senderId}:${m.body}`),
    );
    const stillPending = optimisticMessages.filter(
      (m) => !serverIds.has(m.id) && !recentServerSignatures.has(`${m.senderId}:${m.body}`),
    );
    return [...serverMessages, ...stillPending];
  }, [data, optimisticMessages]);

  useEffect(() => {
    setOptimisticMessages([]);
    setReplyTarget(null);
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) return;
    void markConversationReadAction(conversationId).then(() => {
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["chat-unread"] });
    });
  }, [conversationId, data?.pages[0]?.messages.length, queryClient]);

  // Auto-scroll-to-bottom only for genuinely new messages at the tail, never
  // for a page of older history prepended by scrolling up — that case is
  // handled separately below (it must *preserve* scroll position, not jump
  // to the bottom). Tracked by conversation + tail length so switching
  // threads or a fresh send/incoming message re-triggers it, but loading
  // page 2+ (which changes messages.length the same way) does not.
  const tailLengthRef = useRef(0);
  useEffect(() => {
    const newestPageLength = data?.pages[0]?.messages.length ?? 0;
    if (newestPageLength !== tailLengthRef.current) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    }
    tailLengthRef.current = newestPageLength;
  }, [data?.pages[0]?.messages.length, conversationId]);

  // Loading older history must keep whatever message the user was looking
  // at pinned in place — appending 50 rows above the viewport and leaving
  // scrollTop untouched would otherwise yank the view down by that much.
  const prevScrollHeightRef = useRef<number | null>(null);
  function loadOlder() {
    const el = scrollRef.current;
    if (!el || !hasNextPage || isFetchingNextPage) return;
    prevScrollHeightRef.current = el.scrollHeight;
    void fetchNextPage();
  }
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || prevScrollHeightRef.current === null) return;
    el.scrollTop += el.scrollHeight - prevScrollHeightRef.current;
    prevScrollHeightRef.current = null;
  }, [data?.pages.length]);

  useEffect(() => {
    setTypingUsers(new Map());
    const timers = typingTimersRef.current;
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
  }, [conversationId]);

  function addOptimisticMessage(message: ChatMessage) {
    setOptimisticMessages((prev) => [...prev, message]);
  }

  async function handleSent() {
    // The pending message's temp id never matches the server-assigned UUID,
    // so the id-based dedup in `messages` above can't drop it on its own —
    // once the send resolves, the refetched server list already has the
    // real row, so just clear every pending entry rather than trying to
    // match it up.
    await queryClient.invalidateQueries({ queryKey: ["chat-messages", conversationId] });
    await queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    setOptimisticMessages((prev) => prev.filter((m) => !m.pending));
  }

  if (!conversation) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 bg-background text-center">
        <MessageSquare className="size-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Pick a channel or DM to start chatting</p>
      </div>
    );
  }

  const title = conversation.kind === "channel" ? conversation.name : conversation.otherUser?.displayName;

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-background">
      <div className="flex items-center gap-2.5 border-b border-border px-5 py-3.5">
        {conversation.kind === "channel" ? (
          <span className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
            {conversation.isPrivate ? <Lock className="size-4" /> : <Hash className="size-4" />}
          </span>
        ) : (
          <UserAvatar name={conversation.otherUser?.displayName ?? "?"} avatarUrl={conversation.otherUser?.avatarUrl} />
        )}
        <div className="min-w-0">
          <h2 className="truncate text-[15px] font-semibold tracking-tight text-foreground">{title}</h2>
          {conversation.kind === "channel" && conversation.description && (
            <p className="truncate text-[11px] text-muted-foreground">{conversation.description}</p>
          )}
        </div>
      </div>

      {pinned && (
        <div className="flex items-start gap-2 border-b border-border bg-[var(--accent)]/5 px-5 py-2">
          <Pin className="mt-0.5 size-3.5 shrink-0 text-[var(--accent)]" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-foreground">
              <span className="font-medium">{pinned.senderName}:</span> {pinned.body}
            </p>
            {pinned.pinnedByName && <p className="text-[10px] text-muted-foreground">Pinned by {pinned.pinnedByName}</p>}
          </div>
          <button
            type="button"
            onClick={() => togglePinAction(pinned.id, false).then(() => queryClient.invalidateQueries({ queryKey: ["chat-messages", conversationId] }))}
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Unpin"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      <div
        ref={scrollRef}
        onScroll={(e) => {
          // Within 80px of the top edge — fetch the next page of history
          // before the user actually hits the top, so scrolling never has to
          // pause and wait on a network round trip.
          if (e.currentTarget.scrollTop < 80) loadOlder();
        }}
        className="flex-1 overflow-y-auto px-5 py-4"
      >
        {messages.length === 0 ? (
          // Centered in the full pane height rather than pinned to the top —
          // a single 12px line at the top of an empty 900px column read as a
          // rendering failure rather than an empty conversation.
          <div className="flex h-full min-h-64 flex-col items-center justify-center gap-3 text-center">
            <span className="brand-gradient flex size-12 items-center justify-center rounded-2xl text-white shadow-[0_4px_14px_-4px_color-mix(in_oklch,var(--primary)_40%,transparent)]">
              <MessageSquare className="size-5" strokeWidth={2} />
            </span>
            <div>
              <p className="text-[15px] font-semibold tracking-tight text-foreground">No messages yet</p>
              <p className="mt-1 text-xs text-muted-foreground">Say hello to get the conversation started.</p>
            </div>
          </div>
        ) : (
          <>
            {isFetchingNextPage && (
              <div className="flex justify-center py-2">
                <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
              </div>
            )}
            <MessageGroup
              messages={messages}
              currentUserId={currentUser.id}
              isAdmin={isAdmin}
              conversationId={conversation.id}
              members={orgUsers}
              onReply={setReplyTarget}
            />
          </>
        )}
      </div>

      {typingUsers.size > 0 && (
        <p className="px-5 pb-1 text-[11px] italic text-muted-foreground">
          {[...typingUsers.values()].join(", ")} {typingUsers.size === 1 ? "is" : "are"} typing…
        </p>
      )}

      <Composer
        conversationId={conversation.id}
        currentUser={currentUser}
        mentionCandidates={conversation.kind === "channel" ? orgUsers.filter((u) => u.id !== currentUser.id) : []}
        onOptimisticSend={addOptimisticMessage}
        onSent={handleSent}
        replyTarget={replyTarget}
        onClearReply={() => setReplyTarget(null)}
      />
    </div>
  );
}
