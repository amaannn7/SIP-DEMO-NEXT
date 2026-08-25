// "high" is a one-off, source-system-specific value: it only appears from
// the inbound-lead 2-hour-window branch below, never from the general
// per-stage path. Neither the source system nor this port's own Focus Queue
// escalation logic reacts to it (both only check for "critical"/"overdue"),
// so it's informational-only wherever the raw SLA status is surfaced.
export type SlaUrgency = "on_track" | "due_soon" | "overdue" | "critical" | "complete" | "high";

export type SlaStatus = {
  stage: string;
  daysInStage: number;
  slaDays: number | null;
  isOverdue: boolean;
  urgency: SlaUrgency;
  nextAction: string | null;
  actionType: string | null;
  daysRemaining?: number;
  hoursRemaining?: number;
};

const STAGE_ACTIONS: Record<string, { nextAction: string; actionType: string }> = {
  new_lead: { nextAction: "Verify contact details and begin research", actionType: "research" },
  research: { nextAction: "Complete research and send initial email", actionType: "email" },
  email_sent: { nextAction: "Make follow-up call", actionType: "call" },
  call_attempted: { nextAction: "Log outcome or complete scheduled follow-up", actionType: "outcome" },
  engaged: { nextAction: "Book consultation or schedule next conversation", actionType: "consultation" },
  consultation_booked: { nextAction: "Complete consultation and mark won/lost/nurture", actionType: "consultation" },
  nurture_parked: { nextAction: "Light-touch re-engagement when cooling-off period ends", actionType: "nurture" },
};

/**
 * Ports the source system's calculateSLAStatus, including its inbound-lead
 * 2-hour-callback special case and won/lost short-circuit.
 */
export function calculateSlaStatus(
  lead: { stage: string; source: string; createdAt: Date },
  daysSinceActivity: number,
  slaMaxDaysByStage: Partial<Record<string, number>>,
  now: Date = new Date(),
): SlaStatus {
  const { stage } = lead;

  if (lead.source === "inbound" && stage === "call_attempted") {
    const hoursSinceCreated = Math.floor((now.getTime() - lead.createdAt.getTime()) / 3_600_000);
    return {
      stage,
      daysInStage: daysSinceActivity,
      slaDays: 0,
      isOverdue: hoursSinceCreated > 2,
      urgency: hoursSinceCreated > 2 ? "critical" : "high",
      nextAction: "Call inbound lead within 2 hours",
      actionType: "call",
      hoursRemaining: Math.max(0, 2 - hoursSinceCreated),
    };
  }

  if (stage === "won" || stage === "lost") {
    return {
      stage,
      daysInStage: daysSinceActivity,
      slaDays: null,
      isOverdue: false,
      urgency: "complete",
      nextAction: null,
      actionType: null,
    };
  }

  // nurture_parked is explicitly excluded from overdue/critical flagging,
  // priority scoring, and stale-stage counts in the source system — its
  // 90-day window is informational only, not an SLA to be enforced.
  if (stage === "nurture_parked") {
    return {
      stage,
      daysInStage: daysSinceActivity,
      slaDays: slaMaxDaysByStage[stage] ?? 90,
      isOverdue: false,
      urgency: "on_track",
      nextAction: STAGE_ACTIONS.nurture_parked.nextAction,
      actionType: STAGE_ACTIONS.nurture_parked.actionType,
    };
  }

  const maxDays = slaMaxDaysByStage[stage] ?? slaMaxDaysByStage.new_lead ?? 1;
  const isOverdue = daysSinceActivity > maxDays;

  let urgency: SlaUrgency = "on_track";
  if (isOverdue) {
    urgency = daysSinceActivity > maxDays * 2 ? "critical" : "overdue";
  } else if (daysSinceActivity >= maxDays - 1) {
    urgency = "due_soon";
  }

  const action = STAGE_ACTIONS[stage] ?? STAGE_ACTIONS.new_lead;

  return {
    stage,
    daysInStage: daysSinceActivity,
    slaDays: maxDays,
    isOverdue,
    urgency,
    nextAction: action.nextAction,
    actionType: action.actionType,
    daysRemaining: Math.max(0, maxDays - daysSinceActivity),
  };
}
