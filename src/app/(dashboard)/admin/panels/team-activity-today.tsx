import { Phone, Mail, Search } from "lucide-react";
import { TargetProgressCard } from "@/components/daily/target-progress-card";
import { SectionCard } from "@/components/shared/section-card";
import type { TeamActivityToday } from "@/lib/db/queries/admin-dashboard";

export function TeamActivityTodayPanel({ data }: { data: TeamActivityToday }) {
  return (
    <SectionCard title="Team activity today" description="Org-wide, against default daily targets">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <TargetProgressCard label="Calls" icon={Phone} done={data.callsDone} target={data.callsTarget} />
        <TargetProgressCard label="Emails" icon={Mail} done={data.emailsDone} target={data.emailsTarget} />
        <TargetProgressCard label="Research" icon={Search} done={data.researchDone} target={data.researchTarget} />
      </div>
    </SectionCard>
  );
}
