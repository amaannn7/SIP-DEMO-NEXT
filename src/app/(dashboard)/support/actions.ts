"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/session";
import { FEEDBACK_TICKET_CATEGORIES, SUPPORT_TICKET_CATEGORIES, ticketPriorityEnum, ticketStatusEnum, ticketTypeEnum } from "@/lib/db/schema";
import { createTicket, addTicketReply, updateTicketStatus, deleteTicket } from "@/lib/db/queries/tickets";

const ALL_CATEGORIES = [...new Set([...SUPPORT_TICKET_CATEGORIES, ...FEEDBACK_TICKET_CATEGORIES])] as [string, ...string[]];

const createTicketSchema = z.object({
  type: z.enum(ticketTypeEnum.enumValues),
  category: z.enum(ALL_CATEGORIES),
  priority: z.enum(ticketPriorityEnum.enumValues),
  subject: z.string().trim().min(1, "Subject is required").max(200),
  message: z.string().trim().min(1, "Message is required").max(5000),
});

export type CreateTicketState = { error?: string; ticketId?: string };

export async function createTicketAction(_prevState: CreateTicketState, formData: FormData): Promise<CreateTicketState> {
  const session = await requireAuth();
  const parsed = createTicketSchema.safeParse({
    type: formData.get("type"),
    category: formData.get("category"),
    priority: formData.get("priority"),
    subject: formData.get("subject"),
    message: formData.get("message"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const ticket = await createTicket({
    orgId: session.user.orgId,
    userId: session.user.id,
    userName: session.user.displayName,
    ...parsed.data,
  });

  revalidatePath("/support");
  return { ticketId: ticket.id };
}

const replySchema = z.object({
  ticketId: z.string().uuid(),
  message: z.string().trim().min(1, "Reply cannot be empty").max(5000),
});

export type ReplyState = { error?: string };

export async function replyToTicketAction(_prevState: ReplyState, formData: FormData): Promise<ReplyState> {
  const session = await requireAuth();
  const parsed = replySchema.safeParse({
    ticketId: formData.get("ticketId"),
    message: formData.get("message"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const result = await addTicketReply({
    ticketId: parsed.data.ticketId,
    orgId: session.user.orgId,
    userId: session.user.id,
    userName: session.user.displayName,
    role: session.user.role,
    message: parsed.data.message,
  });
  if ("error" in result) return { error: result.error };

  revalidatePath("/support");
  return {};
}

export async function updateTicketStatusAction(ticketId: string, status: (typeof ticketStatusEnum.enumValues)[number]): Promise<void> {
  const session = await requireAuth();
  await updateTicketStatus({ ticketId, orgId: session.user.orgId, userId: session.user.id, role: session.user.role, status });
  revalidatePath("/support");
}

export async function updateTicketPriorityAction(ticketId: string, priority: (typeof ticketPriorityEnum.enumValues)[number]): Promise<void> {
  const session = await requireAuth();
  await updateTicketStatus({ ticketId, orgId: session.user.orgId, userId: session.user.id, role: session.user.role, priority });
  revalidatePath("/support");
}

export async function deleteTicketAction(ticketId: string): Promise<void> {
  const session = await requireAuth();
  await deleteTicket(ticketId, session.user.orgId, session.user.id, session.user.role);
  revalidatePath("/support");
}
