import { LeadWorkflowTabs } from "@/components/leads/lead-workflow-tabs";
import { requireAuthForPage } from "@/lib/auth/session";
import { getLeadById, listCallLogs } from "@/lib/db/queries/leads";
import { getLatestEnrichment, listEmailHistory, listCallPitches } from "@/lib/db/queries/ai-results";
import { listIcpFields } from "@/lib/db/queries/org-settings";
import { listOrgUsers } from "@/lib/db/queries/users";
import { getAircallSettingsView } from "@/lib/db/queries/aircall-settings";
import { DeleteLeadButton } from "@/app/(dashboard)/leads/[id]/delete-lead-button";
import { ReassignLeadSelect } from "@/app/(dashboard)/leads/[id]/reassign-lead-select";

/**
 * Lead-detail data + content for the /leads/[id] page. Previously also
 * rendered inside a slide-over sheet reached via an intercepting route for
 * in-app navigation; that interception was removed so every navigation to a
 * lead — sidebar, table row, focus queue, direct link — lands on this same
 * full page.
 */
export async function loadLeadDetail(leadId: string) {
  const session = await requireAuthForPage();
  const lead = await getLeadById(session.user.orgId, leadId);
  if (!lead) return null;

  const isAdmin = session.user.role === "admin" || session.user.role === "super_admin";
  // A rep's own Leads list already filters to "my leads" — this is the
  // corresponding server-side check so a rep can't reach a teammate's lead
  // by direct URL either. Admins/super_admins see the whole org's pipeline
  // by design, so this only narrows reps.
  if (!isAdmin && lead.ownerId !== session.user.id) return null;

  const [enrichment, emails, pitches, callLogRows, icpFields, orgUsers, aircallSettings] = await Promise.all([
    getLatestEnrichment(lead.id),
    listEmailHistory(lead.id),
    listCallPitches(lead.id),
    listCallLogs(lead.id),
    listIcpFields(session.user.orgId),
    isAdmin ? listOrgUsers(session.user.orgId) : Promise.resolve(null),
    getAircallSettingsView(session.user.orgId),
  ]);

  return { lead, enrichment, emails, pitches, callLogRows, icpFields, orgUsers, aircallEnabled: aircallSettings.isOperational };
}

export type LeadDetailData = NonNullable<Awaited<ReturnType<typeof loadLeadDetail>>>;

/**
 * Single scrolling column, matching the source system's lead detail modal
 * (a centered dialog with no sidebar of any kind — see modal-body/detail-grid
 * in the legacy index.html). A prior version added a right-rail Activity
 * timeline with no source-system precedent; on narrower modal widths its
 * "Outcome" heading visually collided with the workflow tabs' own "Outcome"
 * label. Removed rather than reflowed — legacy has no activity feed inside
 * the lead detail view at all.
 */
export function LeadDetailBody({ data }: { data: LeadDetailData }) {
  const { lead, enrichment, emails, pitches, callLogRows, icpFields, orgUsers, aircallEnabled } = data;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        {orgUsers ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            Owned by
            <ReassignLeadSelect leadId={lead.id} ownerId={lead.ownerId} users={orgUsers} />
          </div>
        ) : (
          <span className="text-muted-foreground">{lead.owner ? `Owned by ${lead.owner.displayName}` : ""}</span>
        )}
        <DeleteLeadButton leadId={lead.id} />
      </div>

      <LeadWorkflowTabs
        lead={lead}
        enrichment={enrichment}
        emails={emails}
        pitches={pitches}
        callLogRows={callLogRows}
        icpFields={icpFields}
        aircallEnabled={aircallEnabled}
      />
    </div>
  );
}
