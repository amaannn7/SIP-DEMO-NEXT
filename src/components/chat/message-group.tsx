"use client";

import { formatTime, formatWeekdayDate } from "@/lib/format-date";
import { cn } from "@/lib/utils";
import { UserAvatar } from "./user-avatar";
import { MessageRow } from "./message-row";
import type { ChatMessage } from "./types";

const GROUP_WINDOW_MS = 5 * 60 * 1000;

type Group = { senderId: string; senderName: string; senderAvatarUrl: string | null; messages: ChatMessage[] };

function groupMessages(messages: ChatMessage[]): Group[] {
  const groups: Group[] = [];
  for (const message of messages) {
    const last = groups[groups.length - 1];
    const lastMessage = last?.messages[last.messages.length - 1];
    const withinWindow = lastMessage
      ? new Date(message.createdAt).getTime() - new Date(lastMessage.createdAt).getTime() < GROUP_WINDOW_MS
      : false;

    if (last && last.senderId === message.senderId && withinWindow) {
      last.messages.push(message);
    } else {
      groups.push({ senderId: message.senderId, senderName: message.senderName, senderAvatarUrl: message.senderAvatarUrl, messages: [message] });
    }
  }
  return groups;
}

function formatDayHeading(date: Date): string {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return formatWeekdayDate(date);
}

export function MessageGroup({
  messages,
  currentUserId,
  isAdmin,
  conversationId,
  members,
  onReply,
}: {
  messages: ChatMessage[];
  currentUserId: string;
  isAdmin: boolean;
  conversationId: string;
  /** Conversation members, for rendering @mentions distinctly — matches the same candidate set the server checks when deciding who gets a mention notification. */
  members: { id: string; displayName: string }[];
  onReply: (message: ChatMessage) => void;
}) {
  const groups = groupMessages(messages);
  let lastDay = "";

  return (
    <div className="flex flex-col gap-5">
      {groups.map((group, i) => {
        const day = new Date(group.messages[0].createdAt).toDateString();
        const showDayHeading = day !== lastDay;
        lastDay = day;

        const isOwn = group.senderId === currentUserId;

        return (
          <div key={`${group.senderId}-${i}`}>
            {showDayHeading && (
              <div className="mt-1 mb-4 flex items-center justify-center">
                <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase shadow-sm">
                  {formatDayHeading(new Date(group.messages[0].createdAt))}
                </span>
              </div>
            )}
            {/* Own messages sit on the right (avatar + column both flip via
                flex-row-reverse) so "yours vs. theirs" reads at a glance
                without reading every name — everyone else's stays left,
                including in a group channel where multiple other senders
                are visible at once. */}
            <div className={cn("group/msggroup flex gap-3", isOwn && "flex-row-reverse")}>
              <UserAvatar name={group.senderName} avatarUrl={group.senderAvatarUrl} />
              <div className={cn("flex min-w-0 max-w-[75%] flex-1 flex-col", isOwn && "items-end")}>
                <div className={cn("flex items-baseline gap-2", isOwn && "flex-row-reverse")}>
                  <span className="text-[13px] font-semibold text-foreground">{isOwn ? "You" : group.senderName}</span>
                  <span className="text-[10px] text-muted-foreground">{formatTime(new Date(group.messages[0].createdAt))}</span>
                </div>
                <div className="flex w-full flex-col">
                  {group.messages.map((message, msgIndex) => (
                    <MessageRow
                      key={message.id}
                      message={message}
                      isOwn={isOwn}
                      isAdmin={isAdmin}
                      conversationId={conversationId}
                      members={members}
                      onReply={onReply}
                      isFirstInGroup={msgIndex === 0}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
