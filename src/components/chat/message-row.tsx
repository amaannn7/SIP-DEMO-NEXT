"use client";

import { useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FileText, Pencil, Pin, Reply, SmilePlus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/format-date";
import { deleteMessageAction, editMessageAction, toggleReactionAction, togglePinAction } from "@/app/(dashboard)/chat/actions";
import { MessageMarkdown } from "./message-markdown";
import { LinkPreviewCard } from "./link-preview-card";
import { Emoji } from "./emoji";
import type { ChatMessage } from "./types";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentPreview({ attachment, isOwn }: { attachment: NonNullable<ChatMessage["attachment"]>; isOwn: boolean }) {
  // An empty url means the server had the attachment's metadata but
  // couldn't reach S3/MinIO to sign a fresh link for it (see map-message.ts)
  // — show that plainly instead of rendering a dead link that silently does
  // nothing when clicked.
  if (!attachment.url) {
    return (
      <div className={cn("mt-1 flex max-w-xs items-center gap-2 rounded-md border border-dashed border-border bg-muted/30 px-2.5 py-1.5", isOwn && "ml-auto")}>
        <FileText className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{attachment.name} (unavailable right now)</span>
      </div>
    );
  }
  if (attachment.type.startsWith("image/")) {
    return (
      <a
        href={attachment.url}
        target="_blank"
        rel="noopener noreferrer"
        // Fixed pixel width (not max-w-xs) — this sits inside several
        // nested flex-1 ancestors (the message content column, the
        // reversed-row group wrapper for own messages), and a max-width on
        // a block child of a flex chain doesn't reliably cap it: a large
        // image's intrinsic size can still stretch the whole chain wider
        // than intended before max-width ever gets a chance to clamp it.
        // An explicit width has no such ambiguity.
        //
        // ml-auto (own messages only) — the parent content column's own
        // "ml-auto text-right" only right-aligns *inline* content (text);
        // this <a> is a block-level box, and text-align never repositions a
        // block's own box, only the inline content inside it. Without its
        // own ml-auto, a right-aligned own-message image sat flush against
        // the *left* edge of its (correctly right-aligned) parent column
        // instead of the column's right edge, next to "You"'s avatar.
        className={cn("mt-1 block w-64 shrink-0 overflow-hidden rounded-md border border-border", isOwn && "ml-auto")}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- signed S3/MinIO URL, not an optimizable static asset */}
        <img src={attachment.url} alt={attachment.name} className="block max-h-64 w-full object-cover" />
      </a>
    );
  }
  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "mt-1 flex max-w-xs items-center gap-2 rounded-md border border-border bg-muted/50 px-2.5 py-1.5 hover:border-[var(--accent)]",
        isOwn && "ml-auto",
      )}
    >
      <FileText className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-xs text-foreground">{attachment.name}</span>
      <span className="shrink-0 text-[10px] text-muted-foreground">{formatBytes(attachment.size)}</span>
    </a>
  );
}

const QUICK_REACTIONS = ["👍", "🎉", "❤️", "😂", "👀"];

export function MessageRow({
  message,
  isOwn,
  isAdmin,
  conversationId,
  members,
  onReply,
  isFirstInGroup,
}: {
  message: ChatMessage;
  isOwn: boolean;
  isAdmin: boolean;
  conversationId: string;
  members: { id: string; displayName: string }[];
  onReply: (message: ChatMessage) => void;
  /** The group header already shows this group's own timestamp — a later message in the same group shows its own time only on hover, in a fixed-width gutter to its left (Slack's exact pattern), instead of repeating a "SenderName · time" line per message. */
  isFirstInGroup: boolean;
}) {
  const queryClient = useQueryClient();
  const [showReactions, setShowReactions] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.body);
  const [isPending, startTransition] = useTransition();

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: ["chat-messages", conversationId] });
  }

  function react(emoji: string) {
    setShowReactions(false);
    startTransition(async () => {
      await toggleReactionAction(message.id, emoji);
      await invalidate();
    });
  }

  function saveEdit() {
    const body = draft.trim();
    if (!body || body === message.body) {
      setEditing(false);
      return;
    }
    const formData = new FormData();
    formData.set("messageId", message.id);
    formData.set("body", body);
    startTransition(async () => {
      await editMessageAction({}, formData);
      await invalidate();
      setEditing(false);
    });
  }

  function remove() {
    if (!confirm("Delete this message?")) return;
    startTransition(async () => {
      await deleteMessageAction(message.id);
      await invalidate();
    });
  }

  function pin() {
    startTransition(async () => {
      await togglePinAction(message.id, !message.pinnedAt);
      await invalidate();
    });
  }

  const canModify = isOwn || isAdmin;

  if (message.deletedAt) {
    return <p className={cn("py-0.5 text-[13px] text-muted-foreground italic", isOwn && "text-right")}>Message deleted</p>;
  }

  if (editing) {
    return (
      <div className="max-w-lg py-0.5">
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              saveEdit();
            }
            if (e.key === "Escape") setEditing(false);
          }}
          rows={2}
          className="w-full resize-none rounded-md border border-[var(--primary)] bg-background px-2.5 py-1.5 text-[13px] text-foreground outline-none"
        />
        <div className="mt-1 flex gap-2 text-[11px]">
          <button type="button" onClick={saveEdit} disabled={isPending} className="font-medium text-[var(--accent)] hover:underline">
            Save
          </button>
          <button type="button" onClick={() => setEditing(false)} className="text-muted-foreground hover:underline">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative flex w-full items-start">
      {/* The hover-only timestamp is absolutely positioned in the gutter
          beside the message (left gutter for others', right gutter for
          own) rather than a real flex sibling — as a real sibling it either
          ate into the content box's own width (own messages, pushing text
          off the right edge) or shifted layout when it toggled between
          isFirstInGroup and not, which is exactly the "testing" indented
          differently from "hello" bug. Absolute positioning removes it from
          the flow entirely, so it can never affect the content box's size
          or position, only overlay next to it. */}
      {!isFirstInGroup && (
        <span
          className={cn(
            "absolute top-1 w-9 text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100",
            isOwn ? "right-full mr-1 text-right" : "left-full ml-1 text-left",
          )}
        >
          {formatTime(new Date(message.createdAt))}
        </span>
      )}
      <div
        className={cn(
          "min-w-0 flex-1 rounded-lg px-2.5 py-1 transition-colors group-hover:bg-muted/50",
          isFirstInGroup && "-mx-2.5",
          isOwn && "ml-auto text-right",
        )}
      >
        {message.replyTo && (
          <div className={cn("mb-0.5 flex items-center gap-1.5 border-l-2 border-border pl-1.5 text-[11px] text-muted-foreground", isOwn && "flex-row-reverse border-r-2 border-l-0 pr-1.5 pl-0")}>
            <Reply className="size-2.5 shrink-0 -scale-x-100" />
            <span className="font-medium text-foreground/70">{message.replyTo.senderName}</span>
            <span className="truncate">{message.replyTo.body}</span>
          </div>
        )}

        {message.body && (
          <p className="text-[13px] whitespace-pre-wrap text-foreground">
            <MessageMarkdown body={message.body} members={members} />
            {message.editedAt && <span className="ml-1.5 text-[10px] text-muted-foreground">(edited)</span>}
          </p>
        )}

        {message.body && <LinkPreviewCard body={message.body} isOwn={isOwn} />}

        {message.attachment && <AttachmentPreview attachment={message.attachment} isOwn={isOwn} />}

        {message.reactions.length > 0 && (
          <div className={cn("mt-1 flex flex-wrap gap-1", isOwn && "justify-end")}>
            {message.reactions.map((r) => (
              <button
                key={r.emoji}
                type="button"
                onClick={() => react(r.emoji)}
                className="flex items-center gap-1 rounded-full border border-border bg-muted px-1.5 py-0.5 text-[11px] hover:border-[var(--accent)]"
              >
                <Emoji emoji={r.emoji} /> <span className="text-muted-foreground">{r.userIds.length}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={cn("absolute top-0 hidden items-center gap-0.5 rounded-md border border-border bg-card px-1 py-0.5 shadow-sm group-hover:flex", isOwn ? "left-0" : "right-0")}>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowReactions((v) => !v)}
            className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Add reaction"
          >
            <SmilePlus className="size-3.5" />
          </button>
          {showReactions && (
            <div className="absolute top-7 right-0 z-10 flex gap-0.5 rounded-md border border-border bg-card px-1 py-1 shadow-lg">
              {QUICK_REACTIONS.map((emoji) => (
                <button key={emoji} type="button" onClick={() => react(emoji)} className="flex size-7 items-center justify-center rounded hover:bg-muted">
                  <Emoji emoji={emoji} className="size-4" />
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => onReply(message)}
          className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Reply"
        >
          <Reply className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={pin}
          className={cn("flex size-6 items-center justify-center rounded hover:bg-muted", message.pinnedAt ? "text-[var(--accent)]" : "text-muted-foreground hover:text-foreground")}
          aria-label={message.pinnedAt ? "Unpin" : "Pin"}
        >
          <Pin className="size-3.5" />
        </button>
        {isOwn && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Edit"
          >
            <Pencil className="size-3.5" />
          </button>
        )}
        {canModify && (
          <button
            type="button"
            onClick={remove}
            className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-destructive"
            aria-label="Delete"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
