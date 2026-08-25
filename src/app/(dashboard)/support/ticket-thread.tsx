"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { LifeBuoy, MessageSquare, Send, Trash2 } from "lucide-react";
import { formatDateTimeShort, formatTimeAgo } from "@/lib/format-date";
import { replyToTicketAction, updateTicketStatusAction, updateTicketPriorityAction, deleteTicketAction, type ReplyState } from "./actions";
import type { TicketDTO } from "./types";

const STATUS_META: Record<string, { label: string; dotClass: string; textClass: string }> = {
  open: { label: "Open", dotClass: "bg-warning", textClass: "text-warning-foreground" },
  in_progress: { label: "In Progress", dotClass: "bg-[var(--primary)]", textClass: "text-[var(--primary)]" },
  resolved: { label: "Resolved", dotClass: "bg-success", textClass: "text-success" },
  closed: { label: "Closed", dotClass: "bg-muted-foreground", textClass: "text-muted-foreground" },
};

const selectClass = "h-7 rounded-md border border-input bg-background px-2 text-[11px] text-foreground outline-none focus:border-[var(--primary)]";

export function TicketThread({
  ticket,
  isManager,
  currentUserId,
  onChanged,
}: {
  ticket: TicketDTO | null;
  isManager: boolean;
  currentUserId: string;
  onChanged: () => void;
}) {
  if (!ticket) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-muted">
          <MessageSquare className="size-5 text-muted-foreground" />
        </span>
        <p className="text-sm font-medium text-foreground">No ticket selected</p>
        <p className="text-xs text-muted-foreground">Pick one from the list, or file a new one.</p>
      </div>
    );
  }

  const isOwner = ticket.createdBy === currentUserId;
  const canManage = isManager || isOwner;
  const statusMeta = STATUS_META[ticket.status];

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-muted-foreground tabular-nums">TKT-{String(ticket.ticketNo).padStart(4, "0")}</span>
            <h2 className="truncate text-[15px] font-semibold text-foreground">{ticket.subject}</h2>
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {ticket.creator.displayName} &middot; {ticket.type === "feedback" ? "Feedback" : "Support"}
            {ticket.category !== "other" && <> &middot; {ticket.category.replace("_", " ")}</>}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isManager && (
            <select
              defaultValue={ticket.priority}
              onChange={(e) => updateTicketPriorityAction(ticket.id, e.target.value as "low" | "normal" | "high").then(onChanged)}
              className={selectClass}
            >
              <option value="low">Low priority</option>
              <option value="normal">Normal priority</option>
              <option value="high">High priority</option>
            </select>
          )}
          {canManage ? (
            <select
              defaultValue={ticket.status}
              onChange={(e) =>
                updateTicketStatusAction(ticket.id, e.target.value as "open" | "in_progress" | "resolved" | "closed").then(onChanged)
              }
              className={selectClass}
            >
              {Object.entries(STATUS_META).map(([value, meta]) => (
                <option key={value} value={value}>
                  {meta.label}
                </option>
              ))}
            </select>
          ) : (
            <span className={`flex items-center gap-1.5 text-[11px] font-medium ${statusMeta.textClass}`}>
              <span className={`size-1.5 rounded-full ${statusMeta.dotClass}`} aria-hidden />
              {statusMeta.label}
            </span>
          )}
          {canManage && (
            <button
              type="button"
              onClick={() => {
                if (confirm("Delete this ticket? This can't be undone.")) deleteTicketAction(ticket.id).then(onChanged);
              }}
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
              aria-label="Delete ticket"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          <ThreadBubble
            authorName={ticket.creator.displayName}
            isSelf={ticket.creator.id === currentUserId}
            isFirst
            message={ticket.message}
            createdAt={ticket.createdAt}
          />
          {ticket.replies.map((reply) => (
            <ThreadBubble
              key={reply.id}
              authorName={reply.author.displayName}
              isSelf={reply.author.id === currentUserId}
              message={reply.message}
              createdAt={reply.createdAt}
            />
          ))}
        </div>
      </div>

      <div className="border-t border-border px-5 py-3">
        <ReplyComposer ticketId={ticket.id} onSent={onChanged} />
      </div>
    </div>
  );
}

function ThreadBubble({
  authorName,
  isSelf,
  isFirst,
  message,
  createdAt,
}: {
  authorName: string;
  isSelf: boolean;
  isFirst?: boolean;
  message: string;
  createdAt: string;
}) {
  const initials = authorName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className={`flex gap-2.5 ${isSelf ? "flex-row-reverse" : ""}`}>
      <div
        className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
          isFirst ? "brand-gradient text-white" : "bg-muted text-muted-foreground"
        }`}
        title={authorName}
      >
        {isFirst ? <LifeBuoy className="size-3.5" /> : initials || "?"}
      </div>
      <div className={`min-w-0 max-w-[85%] ${isSelf ? "items-end text-right" : ""}`}>
        <p className={`mb-0.5 flex items-baseline gap-1.5 text-[11px] text-muted-foreground ${isSelf ? "flex-row-reverse" : ""}`}>
          <span className="font-semibold text-foreground">{authorName}</span>
          <span title={formatDateTimeShort(new Date(createdAt))}>{formatTimeAgo(new Date(createdAt))}</span>
        </p>
        <div
          className={`inline-block rounded-2xl px-3.5 py-2.5 text-[13px] whitespace-pre-wrap ${
            isSelf ? "rounded-tr-sm bg-[var(--primary)] text-white" : "rounded-tl-sm bg-muted text-foreground"
          }`}
        >
          {message}
        </div>
      </div>
    </div>
  );
}

const initialReplyState: ReplyState = {};

function ReplyComposer({ ticketId, onSent }: { ticketId: string; onSent: () => void }) {
  const [state, formAction] = useActionState(replyToTicketAction, initialReplyState);
  const formRef = useRef<HTMLFormElement>(null);
  const submittedRef = useRef(false);

  useEffect(() => {
    if (submittedRef.current && !state.error) {
      formRef.current?.reset();
      onSent();
    }
    submittedRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to action state changing
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={() => (submittedRef.current = true)}
      className="flex items-end gap-2 rounded-md border border-input bg-background px-3 py-2 focus-within:border-[var(--primary)]"
    >
      <input type="hidden" name="ticketId" value={ticketId} />
      <textarea
        name="message"
        required
        maxLength={5000}
        rows={1}
        placeholder="Write a reply…"
        className="flex-1 resize-none border-none bg-transparent px-0 py-1.5 text-sm outline-none"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            e.currentTarget.form?.requestSubmit();
          }
        }}
      />
      <SendButton />
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
    </form>
  );
}

function SendButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex size-8 shrink-0 items-center justify-center rounded-md bg-[var(--primary)] text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      aria-label="Send reply"
    >
      <Send className="size-3.5" />
    </button>
  );
}
