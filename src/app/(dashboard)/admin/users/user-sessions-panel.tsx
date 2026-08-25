"use client";

import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import type { SessionActivityRow } from "@/lib/db/queries/session-activity";
import { formatTimeAgo, formatActiveMins, formatDateTimeShort } from "@/lib/format-date";

const DAY_OPTIONS = [
  { value: 1, label: "Today" },
  { value: 7, label: "Last 7 days" },
  { value: 30, label: "Last 30 days" },
  { value: 90, label: "Last 90 days" },
];

const ROLE_LABELS: Record<string, string> = { rep: "Rep", admin: "Admin", super_admin: "Super Admin" };

/** Ports the source system's Users-page session activity table (loadUserSessions/sessions-days) — the full per-user history with expandable session drill-down, vs. the compact dashboard preview. */
export function UserSessionsPanel({ initialRows }: { initialRows: SessionActivityRow[] }) {
  const [days, setDays] = useState(7);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["admin-user-sessions", days],
    queryFn: async (): Promise<{ rows: SessionActivityRow[] }> => {
      const res = await fetch(`/api/admin/user-sessions?days=${days}`);
      const json = await res.json();
      // JSON has no Date type — dates arrive as ISO strings and need
      // converting back before formatTimeAgo/formatDateTimeShort (which
      // call .getTime()) can use them.
      const rows: SessionActivityRow[] = json.rows.map((row: SessionActivityRow) => ({
        ...row,
        lastSeenAt: row.lastSeenAt ? new Date(row.lastSeenAt) : null,
        sessions: row.sessions.map((s) => ({ ...s, start: new Date(s.start), end: new Date(s.end) })),
      }));
      return { rows };
    },
    initialData: days === 7 ? { rows: initialRows } : undefined,
  });

  const rows = data?.rows ?? [];

  return (
    <div className="card-surface overflow-x-auto rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border p-4 pb-3">
        <h3 className="text-[15px] font-semibold tracking-tight text-foreground">Session activity</h3>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground outline-none focus:border-[var(--primary)]"
          >
            {DAY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60"
          >
            <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            <th className="px-4 py-2.5">User</th>
            <th className="px-3 py-2.5">Role</th>
            <th className="px-3 py-2.5">Last seen</th>
            <th className="px-3 py-2.5">Last page</th>
            <th className="px-3 py-2.5">Active today</th>
            <th className="px-3 py-2.5 text-right">Sessions</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-xs text-muted-foreground">
                No activity recorded.
              </td>
            </tr>
          )}
          {rows.map((row) => {
            const expanded = expandedUserId === row.userId;
            return (
              <Fragment key={row.userId}>
                <tr className="row-hover">
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-2 font-medium text-foreground">
                      <span className={`size-1.5 shrink-0 rounded-full ${row.isOnline ? "bg-success" : "bg-border"}`} aria-hidden />
                      {row.displayName}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                      {ROLE_LABELS[row.role] ?? row.role}
                    </span>
                  </td>
                  <td className={`px-3 py-2.5 ${row.isOnline ? "text-success" : "text-muted-foreground"}`}>
                    {row.isOnline ? "Online now" : row.lastSeenAt ? formatTimeAgo(row.lastSeenAt) : "–"}
                  </td>
                  <td className="px-3 py-2.5 truncate text-xs text-muted-foreground">{row.lastPage ?? "–"}</td>
                  <td className="px-3 py-2.5 font-medium text-foreground">
                    {row.activeMinsToday > 0 ? formatActiveMins(row.activeMinsToday) : "–"}
                  </td>
                  <td className="px-3 py-2.5 text-right text-foreground">{row.sessionsThisPeriod}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => setExpandedUserId(expanded ? null : row.userId)}
                      disabled={row.sessions.length === 0}
                      className="flex h-6 items-center gap-1 rounded-md border border-input px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
                    >
                      {expanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                      View
                    </button>
                  </td>
                </tr>
                {expanded && (
                  <tr>
                    <td colSpan={7} className="bg-muted/40 px-4 py-2">
                      {row.sessions.length === 0 ? (
                        <p className="py-1 text-xs text-muted-foreground">No sessions in range.</p>
                      ) : (
                        <div className="divide-y divide-border">
                          {row.sessions.map((s, i) => (
                            <div key={i} className="flex items-center justify-between gap-3 py-1.5 text-xs">
                              <span className="text-foreground">
                                {formatDateTimeShort(new Date(s.start))} → {formatDateTimeShort(new Date(s.end))}
                              </span>
                              <span className="text-muted-foreground">
                                {formatActiveMins(s.durationMins)} · {s.pages.join(", ") || "–"}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
