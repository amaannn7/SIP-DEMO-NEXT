import "server-only";

import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { tickets, ticketReplies, users, notifications } from "@/lib/db/schema";
import type { UserRole } from "@/lib/auth/session";

const isManagerRole = (role: UserRole) => role === "admin" || role === "super_admin";

export type TicketWithThread = typeof tickets.$inferSelect & {
  creator: Pick<typeof users.$inferSelect, "id" | "displayName" | "email">;
  replies: (typeof ticketReplies.$inferSelect & {
    author: Pick<typeof users.$inferSelect, "id" | "displayName">;
  })[];
};

/**
 * A rep sees only tickets they filed; an admin/super_admin sees every ticket
 * in the org — matches the source system's tickets endpoint filter exactly.
 * `closed` toggles between the default working queue and the dedicated
 * Closed Tickets view, same split as the source system's `closed=1` param.
 */
export async function listTickets(orgId: string, userId: string, role: UserRole, closed: boolean): Promise<TicketWithThread[]> {
  const scope = isManagerRole(role) ? eq(tickets.orgId, orgId) : and(eq(tickets.orgId, orgId), eq(tickets.createdBy, userId));

  return db.query.tickets.findMany({
    where: and(scope, closed ? eq(tickets.status, "closed") : ne(tickets.status, "closed")),
    orderBy: desc(tickets.createdAt),
    with: {
      creator: { columns: { id: true, displayName: true, email: true } },
      replies: {
        orderBy: (r, { asc }) => asc(r.createdAt),
        with: { author: { columns: { id: true, displayName: true } } },
      },
    },
  });
}

export type TicketSummary = { open: number; inProgress: number; resolved: number; closed: number; total: number };

/** Stat-tile counts — always reflect everything this user can see, regardless of the open/closed toggle above. */
export async function getTicketsSummary(orgId: string, userId: string, role: UserRole): Promise<TicketSummary> {
  const scope = isManagerRole(role) ? eq(tickets.orgId, orgId) : and(eq(tickets.orgId, orgId), eq(tickets.createdBy, userId));

  const rows = await db
    .select({ status: tickets.status, count: sql<number>`count(*)::int` })
    .from(tickets)
    .where(scope)
    .groupBy(tickets.status);

  const byStatus = Object.fromEntries(rows.map((r) => [r.status, r.count]));
  const open = byStatus.open ?? 0;
  const inProgress = byStatus.in_progress ?? 0;
  const resolved = byStatus.resolved ?? 0;
  const closed = byStatus.closed ?? 0;
  return { open, inProgress, resolved, closed, total: open + inProgress + resolved + closed };
}

async function assertCanAccessTicket(ticketId: string, orgId: string, userId: string, role: UserRole) {
  const ticket = await db.query.tickets.findFirst({ where: and(eq(tickets.id, ticketId), eq(tickets.orgId, orgId)) });
  if (!ticket) return null;
  if (!isManagerRole(role) && ticket.createdBy !== userId) return null;
  return ticket;
}

/** Every admin/super_admin in the org — used to fan out a "new ticket filed" notification. */
async function listManagerIds(orgId: string): Promise<string[]> {
  const managers = await db.query.users.findMany({
    where: and(eq(users.orgId, orgId), inArray(users.role, ["admin", "super_admin"])),
    columns: { id: true },
  });
  return managers.map((m) => m.id);
}

export async function createTicket(params: {
  orgId: string;
  userId: string;
  userName: string;
  type: "feedback" | "support";
  category: string;
  priority: "low" | "normal" | "high";
  subject: string;
  message: string;
}) {
  const ticket = await db.transaction(async (tx) => {
    // Per-org sequential ticket number: max+1 under the same transaction as
    // the insert, so two concurrent creates in the same org can't collide —
    // the org_id+ticket_no unique index is the backstop if they still did.
    const [{ nextNo }] = await tx
      .select({ nextNo: sql<number>`coalesce(max(${tickets.ticketNo}), 0) + 1` })
      .from(tickets)
      .where(eq(tickets.orgId, params.orgId));

    const [inserted] = await tx
      .insert(tickets)
      .values({
        orgId: params.orgId,
        ticketNo: nextNo,
        createdBy: params.userId,
        type: params.type,
        category: params.category as (typeof tickets.$inferInsert)["category"],
        priority: params.priority,
        subject: params.subject,
        message: params.message,
      })
      .returning();
    return inserted;
  });

  const managerIds = (await listManagerIds(params.orgId)).filter((id) => id !== params.userId);
  if (managerIds.length > 0) {
    const kindLabel = ticket.type === "feedback" ? "Feedback" : "Support request";
    await db
      .insert(notifications)
      .values(
        managerIds.map((managerId) => ({
          orgId: params.orgId,
          userId: managerId,
          ticketId: ticket.id,
          dedupeKey: `ticket_filed_${ticket.id}_${managerId}`,
          type: "ticket_reply" as const,
          title: `${kindLabel} from ${params.userName}: ${ticket.subject}`,
          body: ticket.message.slice(0, 140),
        })),
      )
      .onConflictDoNothing();
  }

  return ticket;
}

export async function addTicketReply(params: {
  ticketId: string;
  orgId: string;
  userId: string;
  userName: string;
  role: UserRole;
  message: string;
}) {
  const ticket = await assertCanAccessTicket(params.ticketId, params.orgId, params.userId, params.role);
  if (!ticket) return { error: "Ticket not found" as const };

  const isManager = isManagerRole(params.role);
  const isOwner = ticket.createdBy === params.userId;

  const [reply] = await db
    .insert(ticketReplies)
    .values({ ticketId: ticket.id, authorId: params.userId, message: params.message })
    .returning();

  // Auto status, same rules as the source system: a manager replying to
  // someone else's open ticket means it's been picked up; the requester
  // replying to their own resolved/closed ticket means it isn't actually
  // done. Neither rule fires for a manager replying to their own ticket, or
  // a requester replying while already open/in_progress — the status
  // dropdown covers every other transition explicitly.
  let nextStatus = ticket.status;
  if (isManager && !isOwner && ticket.status === "open") nextStatus = "in_progress";
  else if (isOwner && (ticket.status === "resolved" || ticket.status === "closed")) nextStatus = "open";

  await db.update(tickets).set({ status: nextStatus, updatedAt: new Date() }).where(eq(tickets.id, ticket.id));

  // Notify whoever isn't the replier: the owner (if a manager replied) or
  // every manager (if the owner replied) — mirrors who'd want to know.
  const recipientIds = isOwner ? (await listManagerIds(params.orgId)).filter((id) => id !== params.userId) : [ticket.createdBy];
  if (recipientIds.length > 0) {
    await db
      .insert(notifications)
      .values(
        recipientIds.map((recipientId) => ({
          orgId: params.orgId,
          userId: recipientId,
          ticketId: ticket.id,
          dedupeKey: `ticket_reply_${reply.id}_${recipientId}`,
          type: "ticket_reply" as const,
          title: `${params.userName} replied: ${ticket.subject}`,
          body: params.message.slice(0, 140),
        })),
      )
      .onConflictDoNothing();
  }

  return { reply };
}

export async function updateTicketStatus(params: {
  ticketId: string;
  orgId: string;
  userId: string;
  role: UserRole;
  status?: "open" | "in_progress" | "resolved" | "closed";
  priority?: "low" | "normal" | "high";
}) {
  const ticket = await assertCanAccessTicket(params.ticketId, params.orgId, params.userId, params.role);
  if (!ticket) return { error: "Ticket not found" as const };

  const statusChanged = params.status !== undefined && params.status !== ticket.status;
  await db
    .update(tickets)
    .set({
      status: params.status ?? ticket.status,
      priority: params.priority ?? ticket.priority,
      updatedAt: new Date(),
    })
    .where(eq(tickets.id, ticket.id));

  if (statusChanged && ticket.createdBy !== params.userId) {
    const statusLabels: Record<string, string> = { open: "Open", in_progress: "In Progress", resolved: "Resolved", closed: "Closed" };
    await db
      .insert(notifications)
      .values({
        orgId: params.orgId,
        userId: ticket.createdBy,
        ticketId: ticket.id,
        dedupeKey: `ticket_status_${ticket.id}_${params.status}_${Date.now()}`,
        type: "ticket_reply",
        title: `Your ticket was marked ${statusLabels[params.status!] ?? params.status}`,
        body: ticket.subject,
      })
      .onConflictDoNothing();
  }

  return { success: true as const };
}

export async function deleteTicket(ticketId: string, orgId: string, userId: string, role: UserRole) {
  const ticket = await assertCanAccessTicket(ticketId, orgId, userId, role);
  if (!ticket) return { error: "Ticket not found" as const };
  await db.delete(tickets).where(eq(tickets.id, ticket.id));
  return { success: true as const };
}
