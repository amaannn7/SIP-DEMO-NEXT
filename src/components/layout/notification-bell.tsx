"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Bell, Flame, PhoneCall, PhoneMissed, Snowflake, Search as SearchIcon, AtSign, ClipboardCheck, LifeBuoy, X } from "lucide-react";
import type { notificationTypeEnum } from "@/lib/db/schema";

type NotificationType = (typeof notificationTypeEnum.enumValues)[number];
type Notification = {
  id: string;
  leadId: string | null;
  chatConversationId: string | null;
  ticketId: string | null;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
};

const TYPE_ICONS: Record<NotificationType, typeof Bell> = {
  hot_lead: Flame,
  callback_due: PhoneCall,
  callback_overdue: PhoneMissed,
  going_cold: Snowflake,
  stale_research: SearchIcon,
  chat_mention: AtSign,
  call_outcome_pending: ClipboardCheck,
  ticket_reply: LifeBuoy,
};

// Combined generate+list poll, matching the 8-10s cadence the source
// system used for its no-realtime (non-Pusher) notification refresh.
const POLL_INTERVAL_MS = 10_000;

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  // Click-outside (the overlay div below) already closes the dropdown;
  // Escape is the other standard way users expect to dismiss a popover and
  // had no handler at all.
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: async (): Promise<{ notifications: Notification[] }> => {
      const res = await fetch("/api/notifications");
      return res.json();
    },
    refetchInterval: POLL_INTERVAL_MS,
  });

  const items = data?.notifications ?? [];
  const unreadCount = items.filter((n) => !n.isRead).length;

  const postAction = useMutation({
    mutationFn: async (body: { action: string; notificationId?: string }) => {
      await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex size-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Notifications"
      >
        <Bell className="size-4" strokeWidth={1.75} />
        {/* Counted pill rather than a bare dot — the number is the useful part. */}
        {unreadCount > 0 && (
          <span className="tnum absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute top-11 right-0 z-40 w-[22rem] overflow-hidden rounded-2xl border border-border bg-popover shadow-[var(--shadow-overlay)]">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
                Notifications
                {unreadCount > 0 && (
                  <span className="tnum rounded-full bg-[color-mix(in_oklch,var(--primary)_12%,transparent)] px-1.5 text-[10px] font-bold text-[var(--primary)]">
                    {unreadCount}
                  </span>
                )}
              </span>
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={() => postAction.mutate({ action: "mark_all_read" })}
                  className="text-[11px] font-medium text-[var(--primary)] transition-opacity hover:opacity-75"
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {items.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                  <span className="flex size-10 items-center justify-center rounded-full bg-muted">
                    <Bell className="size-4 text-muted-foreground" strokeWidth={1.75} />
                  </span>
                  <p className="text-xs text-muted-foreground">You&rsquo;re all caught up</p>
                </div>
              ) : (
                items.map((n) => {
                  const Icon = TYPE_ICONS[n.type];
                  return (
                    <div
                      key={n.id}
                      className={`group relative flex items-start gap-2.5 border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-muted/60 ${n.isRead ? "" : "bg-[color-mix(in_oklch,var(--primary)_5%,transparent)]"}`}
                    >
                      {/* Unread marker rail, so the read/unread split survives
                          even where the tint is subtle. */}
                      {!n.isRead && (
                        <span className="absolute inset-y-0 left-0 w-0.5 bg-[var(--primary)]" aria-hidden />
                      )}
                      <span
                        className={`mt-px flex size-7 shrink-0 items-center justify-center rounded-lg ${
                          n.isRead
                            ? "bg-muted text-muted-foreground"
                            : "bg-[color-mix(in_oklch,var(--primary)_12%,transparent)] text-[var(--primary)]"
                        }`}
                      >
                        <Icon className="size-3.5" strokeWidth={2} />
                      </span>
                      <Link
                        href={
                          n.leadId
                            ? `/leads/${n.leadId}`
                            : n.chatConversationId
                              ? `/chat?c=${n.chatConversationId}`
                              : n.ticketId
                                ? `/support?t=${n.ticketId}`
                                : "#"
                        }
                        onClick={() => !n.isRead && postAction.mutate({ action: "mark_read", notificationId: n.id })}
                        className="min-w-0 flex-1"
                      >
                        <p className="text-[13px] font-semibold text-foreground">{n.title}</p>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{n.body}</p>
                      </Link>
                      <button
                        type="button"
                        onClick={() => postAction.mutate({ action: "dismiss", notificationId: n.id })}
                        className="opacity-0 transition-opacity group-hover:opacity-100"
                        aria-label="Dismiss"
                      >
                        <X className="size-3 text-muted-foreground hover:text-foreground" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
            {items.length > 0 && (
              <button
                type="button"
                onClick={() => postAction.mutate({ action: "dismiss_all" })}
                className="w-full border-t border-border bg-muted/40 px-4 py-2.5 text-center text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Clear all
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
