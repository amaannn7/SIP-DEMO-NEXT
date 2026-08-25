import Link from "next/link";
import { PhoneCall, Phone, Mail, RotateCcw, Search, AlertTriangle } from "lucide-react";
import { SectionCard } from "@/components/shared/section-card";
import type { QueueSummaryCounts } from "@/lib/db/queries/today-dashboard";

// `tone` drives the icon chip color so the batch list reads as triage at a
// glance — urgent/overdue in magenta and red, routine work in violet.
const BATCHES: {
  key: keyof QueueSummaryCounts;
  label: string;
  action: string;
  icon: typeof Phone;
  href: string;
  tone: string;
}[] = [
  { key: "inboundUrgent", label: "Inbound Urgent", action: "Call Now", icon: PhoneCall, href: "/leads?stage=call_attempted", tone: "var(--accent)" },
  { key: "callsDue", label: "Calls Due", action: "Start Calls", icon: Phone, href: "/leads?stage=email_sent", tone: "var(--primary)" },
  { key: "emailsDue", label: "Emails Due", action: "Queue Emails", icon: Mail, href: "/leads?stage=research", tone: "var(--primary)" },
  { key: "followups", label: "Follow-ups", action: "Re-engage", icon: RotateCcw, href: "/leads", tone: "var(--chart-3)" },
  { key: "research", label: "Research", action: "Research Leads", icon: Search, href: "/leads?stage=research", tone: "var(--chart-3)" },
  { key: "overdue", label: "Overdue", action: "Handle Now", icon: AlertTriangle, href: "/leads", tone: "var(--destructive)" },
];

export function QueueSummaryPanel({ counts }: { counts: QueueSummaryCounts }) {
  return (
    <SectionCard title="Queue summary" description="Work batched by what it needs" href="/leads" hrefLabel="Open Leads">
      <div className="grid grid-cols-2 gap-3">
        {BATCHES.map((batch) => (
          <Link
            key={batch.key}
            href={batch.href}
            className="group flex flex-col gap-2 rounded-lg border border-border p-3 transition-all hover:-translate-y-px hover:border-[color-mix(in_oklch,var(--primary)_35%,var(--border))] hover:bg-muted/60"
          >
            <div className="flex w-full items-center justify-between gap-2">
              <span
                className="flex size-7 shrink-0 items-center justify-center rounded-md"
                style={{
                  background: `color-mix(in oklch, ${batch.tone} 14%, transparent)`,
                  color: batch.tone,
                }}
              >
                <batch.icon className="size-3.5" strokeWidth={2} />
              </span>
              <span className="tnum text-xl font-bold text-foreground">{counts[batch.key]}</span>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-foreground">{batch.label}</p>
              <p className="text-[10px] text-muted-foreground transition-colors group-hover:text-[var(--primary)]">
                {batch.action}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </SectionCard>
  );
}
