import "server-only";

import { listActiveLeadsForScope } from "@/lib/db/queries/leads";
import { getSlaMaxDaysByStage } from "@/lib/db/queries/org-settings";
import { calculateDaysSinceActivity } from "@/lib/scoring/days-since-activity";
import { generateFocusQueue, type FocusQueueLeadInput } from "./generate";
import { findAttentionNeeded, type AttentionLeadInput } from "./attention-needed";

async function loadScopedLeads(orgId: string, ownerId: string | null) {
  const [leads, slaMaxDaysByStage] = await Promise.all([
    listActiveLeadsForScope(orgId, ownerId),
    getSlaMaxDaysByStage(orgId),
  ]);

  const now = new Date();
  const withDays = leads.map((lead) => ({
    lead,
    daysSinceActivity: calculateDaysSinceActivity(
      { lastActivityAt: lead.lastActivityAt, followupDate: lead.followupDate, createdAt: lead.createdAt },
      now,
    ),
  }));

  return { withDays, slaMaxDaysByStage, now };
}

export async function loadFocusQueue(orgId: string, ownerId: string | null, limit: number = 10) {
  const { withDays, slaMaxDaysByStage, now } = await loadScopedLeads(orgId, ownerId);

  const input: FocusQueueLeadInput[] = withDays.map(({ lead, daysSinceActivity }) => ({
    id: lead.id,
    firstName: lead.firstName,
    lastName: lead.lastName,
    company: lead.company,
    title: lead.title,
    source: lead.source,
    stage: lead.stage,
    temperature: lead.temperature,
    velocity: lead.velocity,
    fitGrade: lead.fitGrade,
    followupDate: lead.followupDate,
    skippedUntil: lead.skippedUntil,
    createdAt: lead.createdAt,
    daysSinceActivity,
    ownerId: lead.ownerId,
    ownerName: lead.owner?.displayName ?? null,
    lastCallOutcome: lead.lastCallOutcome,
  }));

  return generateFocusQueue(input, slaMaxDaysByStage, limit, now);
}

export async function loadAttentionNeeded(orgId: string, ownerId: string | null) {
  const { withDays, now } = await loadScopedLeads(orgId, ownerId);

  const input: AttentionLeadInput[] = withDays.map(({ lead, daysSinceActivity }) => ({
    id: lead.id,
    firstName: lead.firstName,
    lastName: lead.lastName,
    company: lead.company,
    stage: lead.stage,
    temperature: lead.temperature,
    velocity: lead.velocity,
    fitGrade: lead.fitGrade,
    followupDate: lead.followupDate,
    daysSinceActivity,
    ownerId: lead.ownerId,
    ownerName: lead.owner?.displayName ?? null,
    callsMadeCount: lead.callsMadeCount,
    lastCallOutcome: lead.lastCallOutcome,
  }));

  return findAttentionNeeded(input, now);
}
