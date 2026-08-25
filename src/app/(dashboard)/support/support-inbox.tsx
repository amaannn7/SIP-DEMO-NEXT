"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { TicketList } from "./ticket-list";
import { TicketThread } from "./ticket-thread";
import { NewTicketDialog } from "./new-ticket-dialog";
import type { TicketDTO, TicketsSummaryDTO } from "./types";

const POLL_INTERVAL_MS = 10_000;

export function SupportInbox({
  initialTickets,
  summary,
  showClosed,
  isManager,
  currentUserId,
  initialActiveId,
}: {
  initialTickets: TicketDTO[];
  summary: TicketsSummaryDTO;
  showClosed: boolean;
  isManager: boolean;
  currentUserId: string;
  initialActiveId?: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(initialActiveId ?? initialTickets[0]?.id ?? null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Polling, not a socket — a helpdesk inbox doesn't need sub-second replies
  // the way team chat does; this matches the same cadence the notification
  // bell already polls at, so a reply/status change lands within ~10s
  // without a manual refresh.
  // initialData guarantees `data` is always defined, so downstream reads
  // don't need a fallback that would otherwise allocate a fresh array/object
  // on every render (defeating memoization further down).
  const { data } = useQuery({
    queryKey: ["support-tickets", showClosed],
    queryFn: async (): Promise<{ tickets: TicketDTO[]; summary: TicketsSummaryDTO }> => {
      const res = await fetch(`/api/support/tickets${showClosed ? "?closed=1" : ""}`);
      return res.json();
    },
    initialData: { tickets: initialTickets, summary },
    refetchInterval: POLL_INTERVAL_MS,
  });

  const { tickets, summary: liveSummary } = data;

  useEffect(() => {
    if (!activeId && tickets.length > 0) setActiveId(tickets[0].id);
  }, [activeId, tickets]);

  const activeTicket = useMemo(() => tickets.find((t) => t.id === activeId) ?? null, [tickets, activeId]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["support-tickets"] });

  return (
    <div className="flex h-[calc(100dvh-1px)] min-h-0">
      <TicketList
        tickets={tickets}
        summary={liveSummary}
        activeId={activeId}
        onSelect={setActiveId}
        onNewTicket={() => setDialogOpen(true)}
        showClosed={showClosed}
        onToggleClosed={() => router.push(showClosed ? "/support" : "/support?closed=1")}
      />
      <TicketThread
        key={activeTicket?.id ?? "empty"}
        ticket={activeTicket}
        isManager={isManager}
        currentUserId={currentUserId}
        onChanged={refresh}
      />
      <NewTicketDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={(id) => {
          refresh();
          setActiveId(id);
        }}
      />
    </div>
  );
}
