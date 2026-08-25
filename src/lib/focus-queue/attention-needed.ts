export type AttentionIssue = {
  type: "going_cold" | "stalled_hot" | "callback_overdue" | "multiple_attempts" | "stale_research";
  message: string;
  severity: "critical" | "warning" | "info";
};

export type AttentionLeadInput = {
  id: string;
  firstName: string;
  lastName: string;
  company: string | null;
  stage: string;
  temperature: "on_fire" | "hot" | "warm" | "cold" | null;
  velocity: "accelerating" | "stable" | "slowing" | "stalled" | null;
  fitGrade: string | null;
  followupDate: Date | null;
  daysSinceActivity: number;
  ownerId: string | null;
  ownerName: string | null;
  callsMadeCount: number;
  lastCallOutcome: string | null;
};

export type AttentionItem = {
  leadId: string;
  name: string;
  company: string;
  temperature: string;
  velocity: string;
  fitGrade: string;
  stage: string;
  issues: AttentionIssue[];
  daysSinceActivity: number;
  ownerId: string | null;
  ownerName: string | null;
};

const EXCLUDED_STAGES = new Set(["nurture_parked", "won", "lost"]);
const SEVERITY_ORDER: Record<AttentionIssue["severity"], number> = { critical: 0, warning: 1, info: 2 };

function toDayString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * No-positive-outcome call outcomes, per the source system's legacyOutcome
 * fallback (its call_history/Aircall branch doesn't apply here — this build
 * has no dialer integration, so every call is logged manually and
 * lastCallOutcome is always the source of truth, never stale).
 */
const NO_ANSWER_OUTCOMES = new Set(["no_answer_retry", "left_voicemail"]);

/** Ports the source system's findAttentionNeeded, including all 5 issue conditions. */
export function findAttentionNeeded(leads: AttentionLeadInput[], now: Date = new Date()): AttentionItem[] {
  const today = toDayString(now);
  const attention: AttentionItem[] = [];

  for (const lead of leads) {
    if (EXCLUDED_STAGES.has(lead.stage)) continue;

    const issues: AttentionIssue[] = [];
    const temp = lead.temperature ?? "cold";
    const velocity = lead.velocity ?? "stalled";

    if ((temp === "hot" || temp === "warm") && lead.daysSinceActivity >= 7) {
      issues.push({
        type: "going_cold",
        message: `Going cold - no activity in ${lead.daysSinceActivity} days`,
        severity: "warning",
      });
    }

    if (temp === "on_fire" && velocity === "stalled") {
      issues.push({ type: "stalled_hot", message: "Hot lead losing momentum", severity: "critical" });
    }

    if (lead.followupDate) {
      const followupDay = toDayString(lead.followupDate);
      if (followupDay < today) {
        const daysOverdue = Math.floor((now.getTime() - lead.followupDate.getTime()) / 86_400_000);
        issues.push({
          type: "callback_overdue",
          message: `Callback overdue by ${daysOverdue} day(s)`,
          severity: daysOverdue > 3 ? "critical" : "warning",
        });
      }
    }

    const noneAnswered = lead.lastCallOutcome === null || NO_ANSWER_OUTCOMES.has(lead.lastCallOutcome);
    if (lead.callsMadeCount >= 3 && noneAnswered) {
      issues.push({
        type: "multiple_attempts",
        message: `${lead.callsMadeCount} call attempts with no answer`,
        severity: "warning",
      });
    }

    if (lead.stage === "research" && lead.daysSinceActivity >= 5) {
      issues.push({
        type: "stale_research",
        message: `Research done ${lead.daysSinceActivity} days ago - no outreach`,
        severity: "warning",
      });
    }

    if (issues.length > 0) {
      attention.push({
        leadId: lead.id,
        name: `${lead.firstName} ${lead.lastName}`.trim(),
        company: lead.company ?? "",
        temperature: temp,
        velocity,
        fitGrade: lead.fitGrade ?? "",
        stage: lead.stage,
        issues,
        daysSinceActivity: lead.daysSinceActivity,
        ownerId: lead.ownerId,
        ownerName: lead.ownerName,
      });
    }
  }

  attention.sort((a, b) => {
    const aMax = Math.min(...a.issues.map((i) => SEVERITY_ORDER[i.severity]), 2);
    const bMax = Math.min(...b.issues.map((i) => SEVERITY_ORDER[i.severity]), 2);
    return aMax - bMax;
  });

  return attention;
}
