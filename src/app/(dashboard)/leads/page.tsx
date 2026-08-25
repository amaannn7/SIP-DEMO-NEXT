import { Suspense } from "react";
import { Topbar } from "@/components/layout/topbar";
import { requireAuthForPage } from "@/lib/auth/session";
import { listOrgUsers } from "@/lib/db/queries/users";
import { LeadsExplorer } from "./leads-explorer";

/**
 * Thin server shell — auth + the rep-picker list only. The actual leads
 * data (list, counts, pagination) is fetched client-side by LeadsExplorer
 * via /api/leads, so every filter/search change updates in place instead of
 * re-navigating and re-rendering this whole page.
 */
export default async function LeadsPage() {
  const session = await requireAuthForPage();
  const isManager = session.user.role === "admin" || session.user.role === "super_admin";

  const orgUsers = isManager ? await listOrgUsers(session.user.orgId) : [];
  const reps = orgUsers.filter((u) => u.role === "rep");

  return (
    <>
      <Topbar title="Leads" />
      {/* useSearchParams inside LeadsExplorer requires a Suspense boundary —
          without it Next.js bails the whole route out of static rendering
          and dev mode surfaces it as a runtime error / forced Fast Refresh
          reload on every edit. */}
      <Suspense fallback={<div className="p-6" />}>
        <LeadsExplorer isManager={isManager} reps={reps} />
      </Suspense>
    </>
  );
}
