import { Phone, Mail, Search } from "lucide-react";
import { Topbar } from "@/components/layout/topbar";
import { AiBriefingPanel } from "@/components/dashboard/ai-briefing-panel";
import { FocusQueueList } from "@/components/dashboard/focus-queue-list";
import { RecentLeadsTable } from "@/components/dashboard/recent-leads-table";
import { TargetProgressCard } from "@/components/daily/target-progress-card";
import { SectionCard, SectionEmpty } from "@/components/shared/section-card";
import { TemperatureTiles } from "./panels/temperature-tiles";
import { QueueSummaryPanel } from "./panels/queue-summary";
import { AttentionNeededPanel } from "./panels/attention-needed";
import { TodayActivityBanner } from "./panels/today-activity-banner";
import { ActionCardsGrid } from "./panels/action-cards-grid";
import { requireAuthForPage } from "@/lib/auth/session";
import { loadFocusQueue, loadAttentionNeeded } from "@/lib/focus-queue/load";
import { loadDashboardBriefingStats } from "@/lib/db/queries/dashboard-briefing";
import { getEffectiveDailyTargets } from "@/lib/db/queries/daily-targets";
import { getDailyProgress } from "@/lib/db/queries/daily-progress";
import { getRecentLeads } from "@/lib/db/queries/dashboard-stats";
import {
  getTemperatureCounts,
  getQueueSummary,
  getTodayActivitySummary,
  getTodaysCalls,
  getEmailsToSend,
} from "@/lib/db/queries/today-dashboard";

export default async function DashboardPage() {
  const session = await requireAuthForPage();
  const firstName = session.user.displayName.split(" ")[0];

  // Reps see their own queue; managers/admins see the whole org's — matches
  // the source system's rep-vs-manager Focus Queue scope. Managers land on
  // this same Today page (via "Team Activity" in their nav), just org-wide.
  const isManager = session.user.role === "admin" || session.user.role === "super_admin";
  const ownerScope = isManager ? null : session.user.id;

  const [
    { items: focusQueueItems, total: focusQueueTotal },
    attentionItems,
    briefingStats,
    dailyTargets,
    dailyProgress,
    temperatureCounts,
    queueSummary,
    todayActivity,
    todaysCalls,
    emailsToSend,
    recentLeads,
  ] = await Promise.all([
    loadFocusQueue(session.user.orgId, ownerScope, 10),
    loadAttentionNeeded(session.user.orgId, ownerScope),
    loadDashboardBriefingStats(session.user.orgId, ownerScope),
    getEffectiveDailyTargets(session.user.orgId, session.user.id),
    getDailyProgress(session.user.orgId, session.user.id),
    getTemperatureCounts(session.user.orgId, ownerScope),
    getQueueSummary(session.user.orgId, ownerScope),
    getTodayActivitySummary(session.user.orgId, ownerScope),
    getTodaysCalls(session.user.orgId, ownerScope, 5),
    getEmailsToSend(session.user.orgId, ownerScope, 5),
    getRecentLeads(session.user.orgId, ownerScope, 5),
  ]);

  return (
    <>
      <Topbar title="Today" subtitle="Ordered daily work and pipeline follow-up" />

      {/*
       * Restructured from a flat single-column stack of nine equal panels
       * (which read as an undifferentiated wall) into the reference's
       * asymmetric layout: full-width hero and KPI rows on top, then a
       * 2:1 primary/rail split where the Focus Queue — the page's actual
       * job — gets the dominant column and supporting panels sit in a rail.
       */}
      <div className="space-y-5 p-6">
        <AiBriefingPanel greetingName={firstName} stats={briefingStats} />

        <TemperatureTiles counts={temperatureCounts} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <TargetProgressCard label="Calls" icon={Phone} done={dailyProgress.callsDone} target={dailyTargets.callsTarget} />
          <TargetProgressCard label="Emails" icon={Mail} done={dailyProgress.emailsDone} target={dailyTargets.emailsTarget} />
          <TargetProgressCard label="Research" icon={Search} done={dailyProgress.researchDone} target={dailyTargets.researchTarget} />
        </div>

        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-3">
          {/* Primary column — the work itself */}
          <div className="space-y-5 xl:col-span-2">
            <SectionCard
              title="Focus Queue"
              count={focusQueueTotal}
              description={isManager ? "Team-wide, ranked by priority" : "Your leads, ranked by priority"}
              href="/leads"
            >
              {focusQueueItems.length === 0 ? (
                <SectionEmpty>Queue is clear. Nothing needs action right now.</SectionEmpty>
              ) : (
                <FocusQueueList items={focusQueueItems} />
              )}
            </SectionCard>

            <ActionCardsGrid todaysCalls={todaysCalls} emailsToSend={emailsToSend} />

            <SectionCard title="Recent leads" description="Latest additions to the pipeline" href="/leads">
              {recentLeads.length === 0 ? (
                <SectionEmpty>No leads yet.</SectionEmpty>
              ) : (
                <RecentLeadsTable leads={recentLeads} />
              )}
            </SectionCard>
          </div>

          {/* Rail — status and context, secondary to the queue */}
          <div className="space-y-5">
            <TodayActivityBanner summary={todayActivity} />
            <QueueSummaryPanel counts={queueSummary} />
            <AttentionNeededPanel items={attentionItems} />
          </div>
        </div>
      </div>
    </>
  );
}
