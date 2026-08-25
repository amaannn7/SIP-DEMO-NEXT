import Link from "next/link";
import type { SessionActivityRow } from "@/lib/db/queries/session-activity";
import { formatTimeAgo, formatActiveMins } from "@/lib/format-date";

/** Ports the source system's dashboard "Session Activity" preview card (cc-user-sessions) — a compact version of the full table on the Users page, with a link there for the complete view. */
export function SessionActivityPanel({ rows }: { rows: SessionActivityRow[] }) {
  const onlineCount = rows.filter((r) => r.isOnline).length;

  return (
    <div className="card-surface overflow-x-auto rounded-xl border border-border bg-card">
      <div className="border-b border-border p-4 pb-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[15px] font-semibold tracking-tight text-foreground">Session activity</h3>
          <div className="flex items-center gap-3">
            {onlineCount > 0 && (
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-success">
                <span className="size-1.5 rounded-full bg-success" />
                {onlineCount} online now
              </span>
            )}
            <Link href="/admin/users" className="text-[11px] font-medium text-[var(--accent)] hover:underline">
              View full →
            </Link>
          </div>
        </div>
      </div>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            <th className="px-4 py-2.5">User</th>
            <th className="px-3 py-2.5">Last seen</th>
            <th className="px-3 py-2.5">Active today</th>
            <th className="px-3 py-2.5 text-right">Sessions (7d)</th>
            <th className="px-4 py-2.5">Last page</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={row.userId} className="row-hover">
              <td className="px-4 py-2.5">
                <span className="flex items-center gap-2 font-medium text-foreground">
                  <span className={`size-1.5 shrink-0 rounded-full ${row.isOnline ? "bg-success" : "bg-border"}`} aria-hidden />
                  {row.displayName}
                </span>
              </td>
              <td className={`px-3 py-2.5 ${row.isOnline ? "text-success" : "text-muted-foreground"}`}>
                {row.isOnline ? "Online now" : row.lastSeenAt ? formatTimeAgo(row.lastSeenAt) : "–"}
              </td>
              <td className="px-3 py-2.5 font-medium text-foreground">
                {row.activeMinsToday > 0 ? formatActiveMins(row.activeMinsToday) : "–"}
              </td>
              <td className="px-3 py-2.5 text-right text-foreground">{row.sessionsThisPeriod || "–"}</td>
              <td className="px-4 py-2.5 truncate text-xs text-muted-foreground">{row.lastPage ?? "–"}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-xs text-muted-foreground">
                No activity recorded yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
