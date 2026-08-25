import { calculateSlaStatus, type SlaStatus } from "@/lib/scoring/sla-status";

export type FocusQueueLeadInput = {
  id: string;
  firstName: string;
  lastName: string;
  company: string | null;
  title: string | null;
  source: string;
  stage: string;
  temperature: "on_fire" | "hot" | "warm" | "cold" | null;
  velocity: "accelerating" | "stable" | "slowing" | "stalled" | null;
  fitGrade: string | null;
  followupDate: Date | null;
  skippedUntil: Date | null;
  createdAt: Date;
  daysSinceActivity: number;
  ownerId: string | null;
  ownerName: string | null;
  lastCallOutcome: string | null;
};

export type FocusQueueItem = {
  leadId: string;
  name: string;
  company: string;
  title: string;
  source: string;
  temperature: string;
  velocity: string;
  fitGrade: string;
  stage: string;
  priorityScore: number;
  suggestedAction: string;
  reason: string;
  urgency: "critical" | "high" | "normal";
  daysSinceActivity: number;
  followupDate: Date | null;
  isOverdue: boolean;
  sla: SlaStatus;
  ownerId: string | null;
  ownerName: string | null;
};

const STAGE_SCORES: Record<string, number> = {
  call_attempted: 60,
  email_sent: 45,
  engaged: 40,
  consultation_booked: 35,
  research: 25,
  new_lead: 20,
};

const TEMP_SCORES: Record<string, number> = { on_fire: 20, hot: 12, warm: 6, cold: 0 };

const EXCLUDED_STAGES = new Set(["won", "lost", "nurture_parked"]);

/** engaged leads with one of these last call outcomes still need a call, not a consultation booking yet. */
const ENGAGED_CALL_OUTCOMES = new Set(["no_answer_retry", "left_voicemail", "callback_requested"]);

function toDayString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Ports the source system's generateFocusQueue: a rules-based priority
 * score (not an AI ranking) built from stage, temperature, SLA/followup
 * status, and activity velocity/recency. Same weights and thresholds as
 * the source — only the tile-industry-specific "Levata mapping" comment
 * naming is generalized.
 */
export function generateFocusQueue(
  leads: FocusQueueLeadInput[],
  slaMaxDaysByStage: Partial<Record<string, number>>,
  limit: number = 10,
  now: Date = new Date(),
): { items: FocusQueueItem[]; total: number } {
  const today = toDayString(now);
  const queue: FocusQueueItem[] = [];

  for (const lead of leads) {
    if (EXCLUDED_STAGES.has(lead.stage)) continue;
    if (lead.skippedUntil && lead.skippedUntil.getTime() > now.getTime()) continue;

    let priorityScore = 0;
    let reason = "";
    let suggestedAction = "";
    let urgency: FocusQueueItem["urgency"] = "normal";

    if (lead.source === "inbound" && lead.stage === "call_attempted") {
      priorityScore += 250;
      reason = "Inbound lead - call within 2 hours";
      suggestedAction = "call";
      urgency = "critical";
    }

    priorityScore += STAGE_SCORES[lead.stage] ?? 0;
    priorityScore += TEMP_SCORES[lead.temperature ?? "cold"] ?? 0;

    let isOverdue = false;
    if (lead.followupDate) {
      const followupDay = toDayString(lead.followupDate);
      if (followupDay < today) {
        priorityScore += 50;
        isOverdue = true;
        urgency = "high";
        const daysOverdue = Math.floor((now.getTime() - lead.followupDate.getTime()) / 86_400_000);
        reason = `Callback overdue by ${daysOverdue} day(s)`;
        suggestedAction = "call";
      } else if (followupDay === today) {
        priorityScore += 30;
        reason = "Callback due today";
        suggestedAction = "call";
        urgency = "high";
      }
    }

    if (lead.velocity === "stalled") {
      priorityScore -= 15;
    } else if (lead.velocity === "slowing") {
      priorityScore -= 10;
    } else if (lead.velocity === "accelerating") {
      priorityScore += 20;
    }

    if (lead.daysSinceActivity <= 3) {
      priorityScore += 20;
    }

    if (!reason) {
      switch (lead.stage) {
        case "new_lead":
          reason = "New lead - needs research";
          suggestedAction = "research";
          break;
        case "research":
          reason = "Research complete - ready for outreach";
          suggestedAction = "email";
          priorityScore += 15;
          break;
        case "email_sent":
          if (lead.daysSinceActivity >= 3) {
            reason = `Email sent ${lead.daysSinceActivity} days ago - follow up`;
            suggestedAction = "followup";
          } else {
            reason = "Email sent - ready to call";
            suggestedAction = "call";
          }
          break;
        case "call_attempted":
          reason = "Call scheduled";
          suggestedAction = "call";
          priorityScore += 25;
          urgency = "high";
          break;
        case "engaged":
          if (lead.lastCallOutcome && ENGAGED_CALL_OUTCOMES.has(lead.lastCallOutcome)) {
            reason = "Engaged - follow up call needed";
            suggestedAction = "call";
          } else {
            reason = "Engaged - book consultation or next step";
            suggestedAction = "consultation";
          }
          break;
        case "consultation_booked":
          reason = "Consultation booked - prepare and confirm";
          suggestedAction = "consultation";
          priorityScore += 40;
          urgency = "critical";
          break;
        default:
          reason = "Review needed";
          suggestedAction = "review";
      }
    }

    const sla = calculateSlaStatus(
      { stage: lead.stage, source: lead.source, createdAt: lead.createdAt },
      lead.daysSinceActivity,
      slaMaxDaysByStage,
      now,
    );

    if (sla.urgency === "critical") {
      urgency = "critical";
    } else if (sla.urgency === "overdue" && urgency === "normal") {
      urgency = "high";
    }

    queue.push({
      leadId: lead.id,
      name: `${lead.firstName} ${lead.lastName}`.trim(),
      company: lead.company ?? "",
      title: lead.title ?? "",
      source: lead.source,
      temperature: lead.temperature ?? "cold",
      velocity: lead.velocity ?? "stalled",
      fitGrade: lead.fitGrade ?? "",
      stage: lead.stage,
      priorityScore,
      suggestedAction,
      reason,
      urgency,
      daysSinceActivity: lead.daysSinceActivity,
      followupDate: lead.followupDate,
      isOverdue,
      sla,
      ownerId: lead.ownerId,
      ownerName: lead.ownerName,
    });
  }

  queue.sort((a, b) => b.priorityScore - a.priorityScore);

  return { items: queue.slice(0, limit), total: queue.length };
}
