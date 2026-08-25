"use client";

import { useMemo, useState } from "react";
import { Hash, Lock, Plus, RotateCw, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatShortDate, formatTime } from "@/lib/format-date";
import { UserAvatar } from "./user-avatar";
import { NewChannelDialog } from "./new-channel-dialog";
import { NewDmPicker } from "./new-dm-picker";
import { ChannelSettingsMenu } from "./channel-settings-menu";
import type { ChannelSummary, ChatUser, ConversationListItem } from "./types";
import type { ChatSocketStatus } from "./use-chat-socket";

function formatPreviewTime(date: Date): string {
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return formatTime(date);
  return formatShortDate(date);
}

export function ConversationList({
  conversations,
  activeId,
  onSelect,
  isAdmin,
  allChannels,
  orgUsers,
  onOpenDm,
  wsStatus,
  onlineUserIds,
}: {
  conversations: ConversationListItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
  isAdmin: boolean;
  allChannels: ChannelSummary[];
  orgUsers: ChatUser[];
  onOpenDm: (userId: string) => void;
  wsStatus: ChatSocketStatus;
  onlineUserIds: Set<string>;
}) {
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [showNewDm, setShowNewDm] = useState(false);

  const channels = useMemo(() => conversations.filter((c) => c.kind === "channel"), [conversations]);
  const dms = useMemo(() => conversations.filter((c) => c.kind === "dm"), [conversations]);

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
        <div>
          <h1 className="text-base font-bold tracking-tight text-foreground">Team Chat</h1>
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
            {wsStatus === "open" ? (
              <>
                <Wifi className="size-3 text-success" /> Live
              </>
            ) : process.env.NEXT_PUBLIC_CHAT_WS_URL ? (
              // A URL IS configured but the socket isn't open — this is a
              // real dropped/retrying connection, distinct from the no-URL
              // case below (a deployment that deliberately runs on polling
              // alone, e.g. Vercel, where there's no chat-ws process to
              // connect to at all — "Reconnecting" there would be a
              // permanent, misleading error state for expected behavior).
              <>
                <WifiOff className="size-3" /> {wsStatus === "connecting" ? "Connecting…" : "Reconnecting…"}
              </>
            ) : (
              <>
                <RotateCw className="size-3" /> Updates every few seconds
              </>
            )}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        <div className="mb-4">
          <div className="mb-1 flex items-center justify-between px-2">
            <p className="text-[10px] font-semibold tracking-wider text-muted-foreground/70 uppercase">Channels</p>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setShowNewChannel(true)}
                className="flex size-5 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-[var(--primary)]"
                aria-label="New channel"
              >
                <Plus className="size-3.5" />
              </button>
            )}
          </div>
          <div className="flex flex-col gap-0.5">
            {channels.map((c) => {
              const fullChannel = allChannels.find((ch) => ch.id === c.id);
              return (
                <ConversationRow
                  key={c.id}
                  conversation={c}
                  active={c.id === activeId}
                  onClick={() => onSelect(c.id)}
                  trailing={isAdmin && fullChannel ? <ChannelSettingsMenu channel={fullChannel} orgUsers={orgUsers} /> : undefined}
                />
              );
            })}
            {channels.length === 0 && <p className="px-2 py-1.5 text-[11px] text-muted-foreground">No channels yet</p>}
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between px-2">
            <p className="text-[10px] font-semibold tracking-wider text-muted-foreground/70 uppercase">Direct messages</p>
            <button
              type="button"
              onClick={() => setShowNewDm(true)}
              className="flex size-5 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-[var(--primary)]"
              aria-label="New direct message"
            >
              <Plus className="size-3.5" />
            </button>
          </div>
          <div className="flex flex-col gap-0.5">
            {dms.map((c) => (
              <ConversationRow
                key={c.id}
                conversation={c}
                active={c.id === activeId}
                onClick={() => onSelect(c.id)}
                isOnline={c.otherUser ? onlineUserIds.has(c.otherUser.id) : undefined}
              />
            ))}
            {dms.length === 0 && <p className="px-2 py-1.5 text-[11px] text-muted-foreground">No conversations yet</p>}
          </div>
        </div>
      </div>

      {showNewChannel && <NewChannelDialog orgUsers={orgUsers} onClose={() => setShowNewChannel(false)} />}
      {showNewDm && (
        <NewDmPicker
          orgUsers={orgUsers}
          onlineUserIds={onlineUserIds}
          onClose={() => setShowNewDm(false)}
          onPick={(userId) => {
            setShowNewDm(false);
            onOpenDm(userId);
          }}
        />
      )}
    </aside>
  );
}

function ConversationRow({
  conversation,
  active,
  onClick,
  trailing,
  isOnline,
}: {
  conversation: ConversationListItem;
  active: boolean;
  onClick: () => void;
  trailing?: React.ReactNode;
  isOnline?: boolean;
}) {
  const label = conversation.kind === "channel" ? conversation.name : (conversation.otherUser?.displayName ?? "Unknown");

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick();
      }}
      className={cn(
        "group relative flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
        active
          ? "bg-[color-mix(in_oklch,var(--primary)_12%,transparent)]"
          : "hover:bg-muted",
      )}
    >
      {active && (
        <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-r-full bg-[var(--primary)]" aria-hidden />
      )}
      {conversation.kind === "channel" ? (
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full",
            active
              ? "bg-[color-mix(in_oklch,var(--primary)_18%,transparent)] text-[var(--primary)]"
              : "bg-muted text-muted-foreground",
          )}
        >
          {conversation.isPrivate ? <Lock className="size-3.5" /> : <Hash className="size-3.5" />}
        </span>
      ) : (
        <UserAvatar name={conversation.otherUser?.displayName ?? "?"} avatarUrl={conversation.otherUser?.avatarUrl} size="sm" isOnline={isOnline} />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1">
          <p className={cn("truncate text-[13px]", conversation.unreadCount > 0 ? "font-semibold text-foreground" : "font-medium text-foreground/90")}>
            {label}
          </p>
          {conversation.lastMessage && (
            <span className="shrink-0 text-[10px] text-muted-foreground">{formatPreviewTime(new Date(conversation.lastMessage.createdAt))}</span>
          )}
        </div>
        <div className="flex items-center justify-between gap-1">
          <p className="truncate text-[11px] text-muted-foreground">
            {conversation.lastMessage ? `${conversation.lastMessage.senderName}: ${conversation.lastMessage.body}` : "No messages yet"}
          </p>
          {conversation.unreadCount > 0 && (
            <span className="tnum flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] px-1 text-[10px] font-bold text-[var(--primary-foreground)]">
              {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
            </span>
          )}
        </div>
      </div>
      {trailing}
    </div>
  );
}
