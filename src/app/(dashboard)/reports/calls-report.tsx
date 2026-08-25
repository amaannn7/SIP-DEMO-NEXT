import type { getCallsReport } from "@/lib/db/queries/reports";
import { CALL_OUTCOME_LABELS } from "@/lib/calls/outcomes";
import { formatDateTime } from "@/lib/format-date";
import { DeleteCallLogButton } from "./delete-call-log-button";

type CallsReportData = Awaited<ReturnType<typeof getCallsReport>>;

export function CallsReport({ data, filter }: { data: CallsReportData; filter?: React.ReactNode }) {
  const total = data.outcomeSummary.reduce((sum, o) => sum + o.count, 0);

  return (
    <div className="card-surface overflow-hidden rounded-xl border border-border bg-card">
      {/* Header, breakdown and table are one card — "Calls" is a titled section
          like Rep activity, not bare text above loose children. */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-4">
        <div>
          <h3 className="text-[15px] font-semibold tracking-tight text-foreground">Calls</h3>
          <p className="mt-1 text-xs text-muted-foreground">Logged calls and their outcomes</p>
        </div>
        {filter}
      </div>

      {/* Total is the headline; outcomes are secondary breakdown tiles. With no
          outcomes logged the total stands alone rather than in a 5-col grid
          that would leave four empty cells. */}
      <div className="grid grid-cols-2 gap-3 px-5 pb-4 sm:grid-cols-3 lg:grid-cols-5">
        <SummaryTile label="Total calls" value={total} primary />
        {data.outcomeSummary.map((o) => (
          <SummaryTile key={o.outcome} label={CALL_OUTCOME_LABELS[o.outcome as keyof typeof CALL_OUTCOME_LABELS] ?? o.outcome} value={o.count} />
        ))}
      </div>

      <div className="overflow-x-auto border-t border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/60">
            <tr className="border-b border-border text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              <th className="px-4 py-2.5">Rep</th>
              <th className="px-3 py-2.5">Lead</th>
              <th className="px-3 py-2.5">Outcome</th>
              <th className="px-3 py-2.5">Notes</th>
              <th className="px-4 py-2.5 text-right">When</th>
              <th className="w-8 px-2 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.rows.map((row) => (
              <tr key={row.id} className="row-hover">
                <td className="px-4 py-2.5 text-foreground">{row.loggedByUser?.displayName ?? "–"}</td>
                <td className="px-3 py-2.5 text-foreground">
                  {row.lead ? [row.lead.firstName, row.lead.lastName].filter(Boolean).join(" ") || row.lead.company : "–"}
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">{row.outcome ? CALL_OUTCOME_LABELS[row.outcome] : "Not yet logged"}</td>
                <td className="max-w-xs truncate px-3 py-2.5 text-muted-foreground">{row.notes ?? ""}</td>
                <td className="px-4 py-2.5 text-right text-muted-foreground">{formatDateTime(new Date(row.createdAt))}</td>
                <td className="px-2 py-2.5">
                  <DeleteCallLogButton callLogId={row.id} />
                </td>
              </tr>
            ))}
            {data.rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-xs text-muted-foreground">
                  No calls logged in this range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryTile({ label, value, primary = false }: { label: string; value: number; primary?: boolean }) {
  return (
    <div
      className={
        primary
          ? "card-surface rounded-xl border border-[color-mix(in_oklch,var(--primary)_30%,var(--border))] bg-[color-mix(in_oklch,var(--primary)_6%,var(--card))] px-4 py-3"
          : "card-surface rounded-xl border border-border bg-card px-4 py-3"
      }
    >
      <p className={primary ? "tnum text-2xl font-bold tracking-tight text-[var(--primary)]" : "tnum text-2xl font-bold tracking-tight text-foreground"}>
        {value}
      </p>
      <p className="mt-0.5 truncate text-[11px] text-muted-foreground" title={label}>{label}</p>
    </div>
  );
}
