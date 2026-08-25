import { requireAuthForPage } from "@/lib/auth/session";
import { listTickets, getTicketsSummary } from "@/lib/db/queries/tickets";
import { SupportInbox } from "./support-inbox";
import type { TicketDTO } from "./types";

export default async function SupportPage({ searchParams }: { searchParams: Promise<{ closed?: string; t?: string }> }) {
  const session = await requireAuthForPage();
  const { closed, t } = await searchParams;
  const showClosed = closed === "1";

  const [tickets, summary] = await Promise.all([
    listTickets(session.user.orgId, session.user.id, session.user.role, showClosed),
    getTicketsSummary(session.user.orgId, session.user.id, session.user.role),
  ]);

  const isManager = session.user.role === "admin" || session.user.role === "super_admin";

  // Matches the shape /api/support/tickets returns (Dates -> ISO strings) —
  // the client's TicketDTO type is the wire shape both this initial render
  // and the polling refetch share, so SupportInbox never has to juggle two
  // different createdAt representations depending on where the data came from.
  const ticketDTOs: TicketDTO[] = tickets.map((ticket) => ({
    ...ticket,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    replies: ticket.replies.map((reply) => ({ ...reply, createdAt: reply.createdAt.toISOString() })),
  }));

  return (
    <SupportInbox
      initialTickets={ticketDTOs}
      summary={summary}
      showClosed={showClosed}
      isManager={isManager}
      currentUserId={session.user.id}
      initialActiveId={t}
    />
  );
}
