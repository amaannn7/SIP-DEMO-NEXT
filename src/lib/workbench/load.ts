import "server-only";

import { listActiveLeadsForScope } from "@/lib/db/queries/leads";
import { generateWorkbenchBuckets, type WorkbenchLeadInput } from "./generate";

/**
 * scope "team" (admin/super-admin only, matches the source system's
 * scope=team on lead-batches) pulls every OTHER rep's leads, excluding the
 * viewer's own — same "team-wide, not mine" semantics as the dashboard's
 * team scope elsewhere in this app.
 */
export async function loadWorkbench(orgId: string, viewerId: string, scope: "mine" | "team") {
  const leads = await listActiveLeadsForScope(orgId, scope === "mine" ? viewerId : null);
  const scoped = scope === "team" ? leads.filter((lead) => lead.ownerId !== viewerId) : leads;

  const input: WorkbenchLeadInput[] = scoped.map((lead) => ({
    id: lead.id,
    firstName: lead.firstName,
    lastName: lead.lastName,
    company: lead.company,
    stage: lead.stage,
    source: lead.source,
    temperature: lead.temperature,
    velocity: lead.velocity,
    fitGrade: lead.fitGrade,
    followupDate: lead.followupDate,
    hasEnrichment: lead.hasEnrichment,
    ownerId: lead.ownerId,
    ownerName: lead.owner?.displayName ?? null,
  }));

  return generateWorkbenchBuckets(input);
}
