import { Topbar } from "@/components/layout/topbar";
import { requireAuthForPage } from "@/lib/auth/session";
import { loadWorkbench } from "@/lib/workbench/load";
import { WorkbenchBoard } from "./workbench-board";

/**
 * Ports the source system's Lead Workbench (`page-workbench` / `lead-batches`)
 * — 7 category buckets a rep or manager can scan for what needs attention
 * next. The source system built this page but never linked it from its own
 * nav (confirmed dead/unreachable in that build) — it's wired into this
 * app's sidebar since there's no reason to leave a finished feature orphaned.
 */
export default async function WorkbenchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireAuthForPage();
  const params = await searchParams;
  const isManager = session.user.role === "admin" || session.user.role === "super_admin";
  const scope = isManager && params.scope === "team" ? "team" : "mine";

  const buckets = await loadWorkbench(session.user.orgId, session.user.id, scope);

  return (
    <>
      <Topbar title="Workbench" subtitle="What needs attention next, grouped by what's needed" />
      <div className="p-6">
        <WorkbenchBoard buckets={buckets} scope={scope} isManager={isManager} />
      </div>
    </>
  );
}
