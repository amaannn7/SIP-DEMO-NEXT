import type { leadStageEnum } from "@/lib/db/schema";

export type LeadStage = (typeof leadStageEnum.enumValues)[number];

export const STAGE_ORDER: LeadStage[] = [
  "new_lead",
  "research",
  "email_sent",
  "call_attempted",
  "engaged",
  "consultation_booked",
  "nurture_parked",
  "won",
  "lost",
];

export const STAGE_LABELS: Record<LeadStage, string> = {
  new_lead: "New Lead",
  research: "Research",
  email_sent: "Email Sent",
  call_attempted: "Call Attempted",
  engaged: "Engaged",
  consultation_booked: "Consultation Booked",
  nurture_parked: "Nurture / Parked",
  won: "Won",
  lost: "Lost",
};
