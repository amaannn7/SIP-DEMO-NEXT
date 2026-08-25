import { Topbar } from "@/components/layout/topbar";
import { requireRoleForPage } from "@/lib/auth/session";
import { getOrgDefaultDailyTargets } from "@/lib/db/queries/daily-targets";
import {
  getOperationsMetrics,
  getTeamActivityToday,
  getPipelineFunnel,
  getLeadSourceSplit,
  getAverageTimeInStage,
  getTeamActivityByRep,
  getParkedLostReasons,
} from "@/lib/db/queries/admin-dashboard";
import { getSessionActivity } from "@/lib/db/queries/session-activity";
import { getCurrentStreak } from "@/lib/db/queries/daily-performance";
import { StreakBadge } from "@/components/shared/streak-badge";
import { OperationsMetricsRow } from "./panels/operations-metrics";
import { TeamActivityTodayPanel } from "./panels/team-activity-today";
import { PipelineFunnelPanel } from "./panels/pipeline-funnel";
import { LeadSourceSplitPanel } from "./panels/lead-source-split";
import { StageAgingPanel } from "./panels/stage-aging";
import { TeamActivityTable } from "./panels/team-activity-table";
import { ParkedLostReasonsPanel } from "./panels/parked-lost-reasons";
import { SessionActivityPanel } from "./panels/session-activity";

export default async function AdminDashboardPage() {
  const session = await requireRoleForPage("admin");

  const orgDefaultTargets = await getOrgDefaultDailyTargets(session.user.orgId);

  const [metrics, teamActivityToday, funnel, sourceSplit, stageAging, repActivity, parkedLostReasons, sessionActivity, streak] = await Promise.all([
    getOperationsMetrics(session.user.orgId),
    getTeamActivityToday(session.user.orgId, orgDefaultTargets),
    getPipelineFunnel(session.user.orgId),
    getLeadSourceSplit(session.user.orgId),
    getAverageTimeInStage(session.user.orgId),
    getTeamActivityByRep(session.user.orgId),
    getParkedLostReasons(session.user.orgId),
    getSessionActivity(session.user.orgId),
    getCurrentStreak(session.user.orgId, session.user.id),
  ]);

  return (
    <>
      <Topbar
        title="Admin Dashboard"
        subtitle="Operations visibility and sales workflow control"
        titleAccessory={<StreakBadge days={streak} />}
      />
      <div className="space-y-5 p-6">
        <OperationsMetricsRow metrics={metrics} />

        <TeamActivityTodayPanel data={teamActivityToday} />

        {/* `items-start` so a short panel keeps its natural height instead of
            being stretched to match a tall neighbour and showing a dead void. */}
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
          <PipelineFunnelPanel stages={funnel} />
          <LeadSourceSplitPanel sources={sourceSplit} />
        </div>

        {/* `items-start` so a short panel keeps its natural height instead of
            being stretched to match a tall neighbour and showing a dead void. */}
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
          <StageAgingPanel entries={stageAging} />
          <ParkedLostReasonsPanel reasons={parkedLostReasons} />
        </div>

        <TeamActivityTable reps={repActivity} />

        <SessionActivityPanel rows={sessionActivity} />
      </div>
    </>
  );
}
