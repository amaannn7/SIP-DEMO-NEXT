import { FileText, Mail, Phone, Search, UserPlus, RefreshCw, Trash2, RotateCcw } from "lucide-react";
import type { LeadActivityEntry } from "@/lib/db/queries/leads";
import { formatDateTime } from "@/lib/format-date";
import { STAGE_LABELS, type LeadStage } from "@/lib/leads/stages";

function stageLabel(stage: string): string {
  return STAGE_LABELS[stage as LeadStage] ?? stage;
}

const TYPE_ICON: Record<string, typeof FileText> = {
  created: UserPlus,
  updated: RefreshCw,
  stage_changed: RefreshCw,
  imported: UserPlus,
  deleted: Trash2,
  restored: RotateCcw,
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

function describePayload(entry: LeadActivityEntry): string | null {
  if (entry.type === "stage_changed" && entry.payload.from && entry.payload.to) {
    return `${stageLabel(String(entry.payload.from))} → ${stageLabel(String(entry.payload.to))}`;
  }
  if (entry.type === "call_logged" && typeof entry.payload.outcome === "string") {
    return entry.payload.outcome.replace(/_/g, " ");
  }
  return null;
}

/** Ports the source system's per-lead activity feed — everything that happened to this lead, in order, in one place. */
export function LeadActivityTimeline({ entries }: { entries: LeadActivityEntry[] }) {
  return (
    <div className="card-surface rounded-xl border border-border bg-card p-4">
      <h3 className="mb-3 text-[15px] font-semibold tracking-tight text-foreground">Activity</h3>
      {entries.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">No activity yet.</p>
      ) : (
        <div className="max-h-96 space-y-2 overflow-y-auto">
          {entries.map((entry) => {
            const Icon = TYPE_ICON[entry.type] ?? FileText;
            const detail = describePayload(entry);
            return (
              <div key={entry.id} className="flex items-start gap-2.5 border-b border-border pb-2 last:border-0 last:pb-0">
                <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border border-border">
                  <Icon className="size-3 text-muted-foreground" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-foreground">
                    <span className="font-medium">{TYPE_LABEL[entry.type] ?? entry.type}</span>
                    {detail && <span className="text-muted-foreground"> · {detail}</span>}
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
