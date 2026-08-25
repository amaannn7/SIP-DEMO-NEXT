import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { RepActivitySummary } from "@/lib/db/queries/admin-dashboard";

/** Initials chip, so a rep row is scannable by avatar as well as by name. */
function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

export function TeamActivityTable({ reps }: { reps: RepActivitySummary[] }) {
  // Per-column maxima drive the inline bars, so each metric is compared
  // against the team's own best rather than an arbitrary fixed scale.
  const max = {
    calls: Math.max(1, ...reps.map((r) => r.calls)),
    emails: Math.max(1, ...reps.map((r) => r.emails)),
    research: Math.max(1, ...reps.map((r) => r.research)),
  };

  return (
    <div className="card-surface overflow-hidden rounded-xl border border-border bg-card">
      <div className="px-5 pt-5 pb-4">
        <h3 className="text-[15px] font-semibold tracking-tight text-foreground">Team activity</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Calls, emails, and research today · consultations booked or won overall
        </p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-5">Rep</TableHead>
            <TableHead>Calls</TableHead>
            <TableHead>Emails</TableHead>
            <TableHead>Research</TableHead>
            <TableHead className="pr-5 text-right">Consults</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reps.map((rep) => (
            <TableRow key={rep.userId}>
              <TableCell className="pl-5">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklch,var(--primary)_12%,transparent)] text-[10px] font-semibold text-[var(--primary)]">
                    {initials(rep.displayName)}
                  </span>
                  <span className="font-medium text-foreground">{rep.displayName}</span>
                </div>
              </TableCell>
              <MetricCell value={rep.calls} max={max.calls} tone="var(--primary)" />
              <MetricCell value={rep.emails} max={max.emails} tone="var(--accent)" />
              <MetricCell value={rep.research} max={max.research} tone="var(--chart-3)" />
              <TableCell className="pr-5 text-right">
                <span className="tnum rounded-full bg-[color-mix(in_oklch,var(--success)_14%,transparent)] px-2 py-0.5 text-xs font-semibold text-[var(--success)]">
                  {rep.consultations}
                </span>
              </TableCell>
            </TableRow>
          ))}
          {reps.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="py-10 text-center text-xs text-muted-foreground">
                No reps in this organization yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

/** Number plus a proportional bar — turns a column of bare digits into a comparison. */
function MetricCell({ value, max, tone }: { value: number; max: number; tone: string }) {
  return (
    <TableCell>
      <div className="flex items-center gap-2">
        <span className="tnum w-6 text-[13px] font-semibold text-foreground">{value}</span>
        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
          <span
            className="block h-full rounded-full"
            style={{ width: `${(value / max) * 100}%`, background: tone }}
          />
        </span>
      </div>
    </TableCell>
  );
}
