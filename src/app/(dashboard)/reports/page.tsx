import { Topbar } from "@/components/layout/topbar";
import { requireRoleForPage } from "@/lib/auth/session";
import { resolveReportRange, type ReportRangePreset } from "@/lib/reports/date-range";
import { getRepActivityReport, getCallsReport, getActivityTimeline } from "@/lib/db/queries/reports";
import { listOrgUsers } from "@/lib/db/queries/users";
import { RangeFilter } from "./range-filter";
import { RepActivityTable } from "./rep-activity-table";
import { CallsReport } from "./calls-report";
import { CallsFilter } from "./calls-filter";
import { ActivityTimeline } from "./activity-timeline";

const VALID_PRESETS: ReportRangePreset[] = ["today", "this_week", "this_month", "custom"];

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string; repId?: string; outcome?: string }>;
}) {
  const session = await requireRoleForPage("super_admin");
  const params = await searchParams;

  const preset = VALID_PRESETS.includes(params.range as ReportRangePreset) ? (params.range as ReportRangePreset) : "today";
  const range = resolveReportRange(preset, params.from, params.to);

  const [repActivity, calls, timeline, orgUsers] = await Promise.all([
    getRepActivityReport(session.user.orgId, range),
    getCallsReport(session.user.orgId, range, { repId: params.repId, outcome: params.outcome }),
    getActivityTimeline(session.user.orgId, range),
    listOrgUsers(session.user.orgId),
  ]);

  const reps = orgUsers.filter((u) => u.role === "rep");

  return (
    <>
      <Topbar title="Reports" subtitle="Team activity and call reports" />
      <div className="space-y-5 p-6">
        <RangeFilter activePreset={range.preset} />

        {/* Headings moved inside their cards (RepActivityTable / CallsReport own
            them now) — floating bare text above a card read as an unstyled
            fragment rather than a titled section. */}
        <RepActivityTable rows={repActivity} />

        <CallsReport data={calls} filter={<CallsFilter reps={reps} />} />

        <ActivityTimeline entries={timeline} />
      </div>
    </>
  );
}
