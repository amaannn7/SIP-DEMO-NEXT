export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
export type TicketPriority = "low" | "normal" | "high";
export type TicketType = "feedback" | "support";

export type TicketReplyDTO = {
  id: string;
  message: string;
  createdAt: string;
  author: { id: string; displayName: string };
};

export type TicketDTO = {
  id: string;
  ticketNo: number;
  type: TicketType;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  subject: string;
  message: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  creator: { id: string; displayName: string; email: string };
  replies: TicketReplyDTO[];
};

export type TicketsSummaryDTO = { open: number; inProgress: number; resolved: number; closed: number; total: number };
