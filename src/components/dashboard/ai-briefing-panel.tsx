import { PieChart } from "lucide-react";
import type { DashboardBriefingStats } from "@/lib/db/queries/dashboard-briefing";

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

/** Fixed bullet order, matching the source system: on-fire -> callbacks due -> emails ready -> overdue. A count of 0 skips that bullet entirely. */
function buildBriefingLines(stats: DashboardBriefingStats): string[] {
  const lines: string[] = [];
  if (stats.onFireCount > 0) {
    lines.push(
      `${stats.onFireCount} priority ${pluralize(stats.onFireCount, "lead needs", "leads need")} immediate attention`,
    );
  }
  if (stats.callbacksDue > 0) {
    lines.push(`${stats.callbacksDue} ${pluralize(stats.callbacksDue, "callback", "callbacks")} due today`);
  }
  if (stats.emailsReady > 0) {
    lines.push(`${stats.emailsReady} ${pluralize(stats.emailsReady, "email", "emails")} ready to send`);
  }
  if (stats.overdueCount > 0) {
    lines.push(`${stats.overdueCount} ${pluralize(stats.overdueCount, "lead", "leads")} overdue. Action needed`);
  }
  return lines;
}

/**
 * The page's hero surface — the one place on Today allowed to carry the brand
 * gradient (as a soft wash behind the greeting, never behind the body copy;
 * see DESIGN.md §1). Rules-based stat summary, not an LLM call.
 */
export function AiBriefingPanel({ greetingName, stats }: { greetingName: string; stats: DashboardBriefingStats }) {
  const lines = buildBriefingLines(stats);

  return (
    <div className="card-surface relative overflow-hidden rounded-xl border border-border bg-card px-6 py-5">
      {/* Soft gradient bloom anchored to the top-right, kept clear of the text
          column so contrast never depends on where the wash lands. */}
      <div
        className="brand-gradient-soft pointer-events-none absolute -top-24 -right-16 size-64 rounded-full blur-3xl"
        aria-hidden
      />

      <div className="relative flex items-start gap-4">
        <div className="brand-gradient flex size-11 shrink-0 items-center justify-center rounded-xl text-white shadow-[0_4px_12px_-2px_color-mix(in_oklch,var(--primary)_35%,transparent)]">
          <PieChart className="size-5" strokeWidth={2} />
        </div>

        <div className="min-w-0">
          <h2 className="text-lg font-bold tracking-tight text-foreground">
            Hi {greetingName}, ready to close?
          </h2>
          {lines.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">Nothing urgent right now. Pipeline is under control.</p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5">
              {lines.map((line) => (
                <li key={line} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="size-1.5 shrink-0 rounded-full bg-[var(--primary)]" aria-hidden />
                  {line}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
