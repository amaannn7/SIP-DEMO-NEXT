import { Phone, Mail, Search } from "lucide-react";
import { Topbar } from "@/components/layout/topbar";
import { TargetProgressCard } from "@/components/daily/target-progress-card";
import { StreakBadge } from "@/components/shared/streak-badge";
import { requireAuthForPage } from "@/lib/auth/session";
import { getEffectiveDailyTargets } from "@/lib/db/queries/daily-targets";
import { getDailyProgress } from "@/lib/db/queries/daily-progress";
import { listCommitmentsForToday } from "@/lib/db/queries/daily-commitments";
import { getCurrentStreak, saveDailyPerformanceSnapshot } from "@/lib/db/queries/daily-performance";
import { TargetsForm } from "./targets-form";
import { CommitmentsList } from "./commitments-list";

export default async function CommitmentsPage() {
  const session = await requireAuthForPage();

  const [targets, progress, commitments] = await Promise.all([
    getEffectiveDailyTargets(session.user.orgId, session.user.id),
    getDailyProgress(session.user.orgId, session.user.id),
    listCommitmentsForToday(session.user.orgId, session.user.id),
  ]);

  await saveDailyPerformanceSnapshot({
    orgId: session.user.orgId,
    userId: session.user.id,
    callsDone: progress.callsDone,
    callsTarget: targets.callsTarget,
    emailsDone: progress.emailsDone,
    emailsTarget: targets.emailsTarget,
    researchDone: progress.researchDone,
    researchTarget: targets.researchTarget,
  });

  const streak = await getCurrentStreak(session.user.orgId, session.user.id);

  return (
    <>
      <Topbar title="Today's Commitments" subtitle="Your daily targets and tasks" titleAccessory={<StreakBadge days={streak} />} />

      <div className="space-y-5 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <TargetProgressCard label="Calls" icon={Phone} done={progress.callsDone} target={targets.callsTarget} />
          <TargetProgressCard label="Emails" icon={Mail} done={progress.emailsDone} target={targets.emailsTarget} />
          <TargetProgressCard label="Research" icon={Search} done={progress.researchDone} target={targets.researchTarget} />
        </div>

        <div className="card-surface rounded-xl border border-border bg-card p-5">
          <h3 className="mb-1 text-[15px] font-semibold tracking-tight text-foreground">Daily targets</h3>
          <p className="mb-4 text-[11px] text-muted-foreground">Override your organization&rsquo;s default targets.</p>
          <TargetsForm targets={targets} />
        </div>

        <CommitmentsList today={commitments.today} carriedOver={commitments.carriedOver} />
      </div>
    </>
  );
}
