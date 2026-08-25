import { FileText, Mail, Phone, Search, UserPlus, RefreshCw } from "lucide-react";
import type { ActivityTimelineEntry } from "@/lib/db/queries/reports";
import { formatDateTime } from "@/lib/format-date";

const TYPE_ICON: Record<string, typeof FileText> = {
  created: UserPlus,
  updated: RefreshCw,
  stage_changed: RefreshCw,
  imported: UserPlus,
  enrichment_completed: Search,
  email_generated: Mail,
  email_sent: Mail,
  call_pitch_generated: Phone,
  call_logged: Phone,
};

const TYPE_LABEL: Record<string, string> = {
  created: "Lead created",
  updated: "Lead updated",
  stage_changed: "Stage changed",
  imported: "Lead imported",
  deleted: "Lead deleted",
  restored: "Lead restored",
  enrichment_completed: "Research completed",
  email_generated: "Email drafted",
  email_sent: "Email sent",
  call_pitch_generated: "Call pitch generated",
  call_logged: "Call logged",
};

export function ActivityTimeline({ entries }: { entries: ActivityTimelineEntry[] }) {
  return (
    <div className="card-surface rounded-xl border border-border bg-card p-5">
      <h3 className="mb-3 text-[15px] font-semibold tracking-tight text-foreground">Activity timeline</h3>
      {entries.length === 0 ? (
        <p className="py-8 text-center text-xs text-muted-foreground">No activity in this range.</p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => {
            const Icon = TYPE_ICON[entry.type] ?? FileText;
            return (
              <div key={entry.id} className="flex items-start gap-2.5 border-b border-border pb-2 last:border-0 last:pb-0">
                <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border border-border">
                  <Icon className="size-3 text-muted-foreground" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-foreground">
                    <span className="font-medium">{TYPE_LABEL[entry.type] ?? entry.type}</span>
                    {entry.leadName && <span className="text-muted-foreground"> · {entry.leadName}</span>}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {entry.actorName ?? "System"} · {formatDateTime(new Date(entry.createdAt))}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
