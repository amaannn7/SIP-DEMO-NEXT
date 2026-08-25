import type { RepActivityRow } from "@/lib/db/queries/reports";

export function RepActivityTable({ rows }: { rows: RepActivityRow[] }) {
  const totals = rows.reduce(
    (acc, r) => ({
      calls: acc.calls + r.calls,
      conversions: acc.conversions + r.conversions,
      emails: acc.emails + r.emails,
      research: acc.research + r.research,
      leadsCreated: acc.leadsCreated + r.leadsCreated,
    }),
    { calls: 0, conversions: 0, emails: 0, research: 0, leadsCreated: 0 },
  );
  const teamConvRate = totals.calls > 0 ? Math.round((totals.conversions / totals.calls) * 100) : 0;

  return (
    <div className="card-surface overflow-hidden rounded-xl border border-border bg-card">
      <div className="px-5 pt-5 pb-4">
        <h3 className="text-[15px] font-semibold tracking-tight text-foreground">Rep activity</h3>
        <p className="mt-1 text-xs text-muted-foreground">Per-rep output over the selected range</p>
      </div>
      <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted/60">
          <tr className="border-b border-border text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            <th className="px-4 py-2.5">Rep</th>
            <th className="px-3 py-2.5 text-right">Calls</th>
            <th className="px-3 py-2.5 text-right">Conversions</th>
            <th className="px-3 py-2.5 text-right">Conv. rate</th>
            <th className="px-3 py-2.5 text-right">Emails</th>
            <th className="px-3 py-2.5 text-right">Research</th>
            <th className="px-3 py-2.5 text-right">Leads created</th>
            <th className="px-3 py-2.5 text-right">Active days</th>
            <th className="px-4 py-2.5 text-right">Avg calls/day</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => {
            const convRate = row.calls > 0 ? Math.round((row.conversions / row.calls) * 100) : 0;
            const avgCallsPerDay = row.activeDays > 0 ? (row.calls / row.activeDays).toFixed(1) : "0.0";
            return (
              <tr key={row.userId} className="row-hover">
                <td className="px-4 py-2.5 font-medium text-foreground">{row.displayName}</td>
                <td className="px-3 py-2.5 text-right text-foreground">{row.calls}</td>
                <td className="px-3 py-2.5 text-right text-foreground">{row.conversions}</td>
                <td className="px-3 py-2.5 text-right text-muted-foreground">{convRate}%</td>
                <td className="px-3 py-2.5 text-right text-foreground">{row.emails}</td>
                <td className="px-3 py-2.5 text-right text-foreground">{row.research}</td>
                <td className="px-3 py-2.5 text-right text-foreground">{row.leadsCreated}</td>
                <td className="px-3 py-2.5 text-right text-muted-foreground">{row.activeDays}</td>
                <td className="px-4 py-2.5 text-right text-muted-foreground">{avgCallsPerDay}</td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={9} className="px-4 py-8 text-center text-xs text-muted-foreground">
                No reps in this organization yet.
              </td>
            </tr>
          )}
        </tbody>
        {rows.length > 0 && (
          <tfoot>
            <tr className="border-t border-border bg-muted/40 text-[15px] font-semibold tracking-tight text-foreground">
              <td className="px-4 py-2.5">Team total</td>
              <td className="px-3 py-2.5 text-right">{totals.calls}</td>
              <td className="px-3 py-2.5 text-right">{totals.conversions}</td>
              <td className="px-3 py-2.5 text-right font-normal text-muted-foreground">{teamConvRate}%</td>
              <td className="px-3 py-2.5 text-right">{totals.emails}</td>
              <td className="px-3 py-2.5 text-right">{totals.research}</td>
              <td className="px-3 py-2.5 text-right">{totals.leadsCreated}</td>
              <td className="px-3 py-2.5" />
              <td className="px-4 py-2.5" />
            </tr>
          </tfoot>
        )}
      </table>
      </div>
    </div>
  );
}
