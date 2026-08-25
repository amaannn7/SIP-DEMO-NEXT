export type WorkbenchCategory =
  | "inbound_urgent"
  | "needs_research"
  | "needs_outreach"
  | "needs_calling"
  | "needs_followup"
  | "hot_focus"
  | "overdue";

export const WORKBENCH_CATEGORIES: { key: WorkbenchCategory; title: string; description: string; action: string }[] = [
  { key: "inbound_urgent", title: "Inbound Urgent", description: "Inbound leads waiting on a first call", action: "Call now" },
  { key: "needs_research", title: "Needs Research", description: "New leads with no research yet", action: "Open next lead" },
  { key: "needs_outreach", title: "Needs Outreach", description: "Researched, ready for a first email", action: "Open next lead" },
  { key: "needs_calling", title: "Needs Calling", description: "Emailed or already attempted, ready for a call", action: "Open next lead" },
  { key: "needs_followup", title: "Needs Follow-up", description: "Follow-up due today, or activity has stalled", action: "Open next lead" },
  { key: "hot_focus", title: "Hot Focus", description: "On fire or hot temperature, still open", action: "View all" },
  { key: "overdue", title: "Overdue", description: "Follow-up date has passed", action: "Open next lead" },
];

export type WorkbenchLeadInput = {
  id: string;
  firstName: string;
  lastName: string;
  company: string | null;
  stage: string;
  source: string;
  temperature: "on_fire" | "hot" | "warm" | "cold" | null;
  velocity: "accelerating" | "stable" | "slowing" | "stalled" | null;
  fitGrade: string | null;
  followupDate: Date | null;
  hasEnrichment: boolean;
  ownerId: string | null;
  ownerName: string | null;
};

export type WorkbenchLeadItem = {
  leadId: string;
  name: string;
  company: string;
  stage: string;
  temperature: string;
  fitGrade: string;
  ownerId: string | null;
  ownerName: string | null;
};

const TEMP_RANK: Record<string, number> = { on_fire: 4, hot: 3, warm: 2, cold: 1 };
const GRADE_RANK: Record<string, number> = { A: 4, B: 3, C: 2, D: 1 };
const NO_FOLLOWUP_STAGES = new Set(["consultation_booked", "nurture_parked"]);
const NO_FOLLOWUP_OR_CLOSED_STAGES = new Set(["consultation_booked", "nurture_parked", "won", "lost"]);
const NEEDS_CALLING_STAGES = new Set(["email_sent", "call_attempted"]);

function toDayString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function sortBucket(items: WorkbenchLeadItem[]): WorkbenchLeadItem[] {
  return [...items].sort((a, b) => {
    const tempDiff = (TEMP_RANK[b.temperature] ?? 0) - (TEMP_RANK[a.temperature] ?? 0);
    if (tempDiff !== 0) return tempDiff;
    return (GRADE_RANK[b.fitGrade] ?? 0) - (GRADE_RANK[a.fitGrade] ?? 0);
  });
}

function toItem(lead: WorkbenchLeadInput): WorkbenchLeadItem {
  return {
    leadId: lead.id,
    name: `${lead.firstName} ${lead.lastName}`.trim(),
    company: lead.company ?? "",
    stage: lead.stage,
    temperature: lead.temperature ?? "cold",
    fitGrade: lead.fitGrade ?? "",
    ownerId: lead.ownerId,
    ownerName: lead.ownerName,
  };
}

/**
 * Ports the source system's lead-batches bucketing exactly (api.php's
 * 'lead-batches' handler): 7 categories, each its own independent condition
 * — a lead can legitimately land in several buckets at once (these are
 * separate `if`s in the source, not a mutually-exclusive switch, except for
 * the three stage-based buckets which really are mutually exclusive by
 * construction). Excludes soft-deleted leads (already filtered upstream by
 * listActiveLeadsForScope) and won/lost leads from every bucket.
 */
export function generateWorkbenchBuckets(
  leads: WorkbenchLeadInput[],
  now: Date = new Date(),
): Record<WorkbenchCategory, WorkbenchLeadItem[]> {
  const today = toDayString(now);
  const buckets: Record<WorkbenchCategory, WorkbenchLeadItem[]> = {
    inbound_urgent: [],
    needs_research: [],
    needs_outreach: [],
    needs_calling: [],
    needs_followup: [],
    hot_focus: [],
    overdue: [],
  };

  for (const lead of leads) {
    if (lead.stage === "won" || lead.stage === "lost") continue;
    const item = toItem(lead);

    if (lead.source === "inbound" && lead.stage === "call_attempted") {
      buckets.inbound_urgent.push(item);
    }

    if (lead.stage === "new_lead") {
      buckets.needs_research.push(item);
    } else if (lead.stage === "research") {
      buckets.needs_outreach.push(item);
    } else if (NEEDS_CALLING_STAGES.has(lead.stage)) {
      buckets.needs_calling.push(item);
    }

    const followupDay = lead.followupDate ? toDayString(lead.followupDate) : null;

    if ((followupDay === today || lead.velocity === "stalled") && lead.hasEnrichment && !NO_FOLLOWUP_STAGES.has(lead.stage)) {
      buckets.needs_followup.push(item);
    }

    if ((lead.temperature === "on_fire" || lead.temperature === "hot") && !NO_FOLLOWUP_STAGES.has(lead.stage)) {
      buckets.hot_focus.push(item);
    }

    if (followupDay !== null && followupDay < today && !NO_FOLLOWUP_OR_CLOSED_STAGES.has(lead.stage)) {
      buckets.overdue.push(item);
    }
  }

  for (const key of Object.keys(buckets) as WorkbenchCategory[]) {
    buckets[key] = sortBucket(buckets[key]);
  }

  return buckets;
}
