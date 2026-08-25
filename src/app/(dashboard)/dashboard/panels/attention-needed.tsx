import Link from "next/link";
import { AlertOctagon, AlertTriangle, ChevronRight } from "lucide-react";
import { SectionCard } from "@/components/shared/section-card";
import type { AttentionItem } from "@/lib/focus-queue/attention-needed";

/**
 * The rail caps how many rows it paints. The query is unbounded and a busy org
 * flags 40+ leads, which made this panel run several times longer than the whole
 * main column and left a huge void beside it. Critical items sort first, so the
 * cap never hides the most urgent rows, and the remainder gets a link out.
 */
const VISIBLE_LIMIT = 8;

export function AttentionNeededPanel({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) return null;

  const isCriticalItem = (item: AttentionItem) => item.issues.some((i) => i.severity === "critical");
  // Stable partition rather than a comparator: preserves the query's existing
  // ordering within each severity group.
  const ordered = [...items.filter(isCriticalItem), ...items.filter((i) => !isCriticalItem(i))];
  const visible = ordered.slice(0, VISIBLE_LIMIT);
  const hidden = ordered.length - visible.length;

  return (
    <SectionCard title="Attention needed" count={items.length} description="Leads at risk of going cold">
      <div className="space-y-2">
        {visible.map((item) => {
          const isCritical = item.issues.some((i) => i.severity === "critical");
          const tone = isCritical ? "var(--destructive)" : "var(--warning)";
          return (
            <Link
              key={item.leadId}
              href={`/leads/${item.leadId}`}
              className="group flex items-start gap-3 rounded-lg border border-border p-3 transition-all hover:-translate-y-px hover:bg-muted/60"
              // Severity is carried by a left edge as well as the icon, so the
              // critical/warning split survives at a glance in a long list.
              style={{ borderLeft: `3px solid ${tone}` }}
            >
              <span
                className="mt-px flex size-7 shrink-0 items-center justify-center rounded-md"
                style={{ background: `color-mix(in oklch, ${tone} 14%, transparent)`, color: tone }}
              >
                {isCritical ? (
                  <AlertOctagon className="size-3.5" strokeWidth={2} />
                ) : (
                  <AlertTriangle className="size-3.5" strokeWidth={2} />
                )}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-foreground">
                  {item.name}
                  {item.company && <span className="font-normal text-muted-foreground"> · {item.company}</span>}
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                  {item.issues.map((i) => i.message).join(" • ")}
                </p>
              </div>

              <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </Link>
          );
        })}
      </div>

      {hidden > 0 && (
        <Link
          href="/leads"
          className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
        >
          +{hidden} more needing attention
          <ChevronRight className="size-3.5" />
        </Link>
      )}
    </SectionCard>
  );
}
