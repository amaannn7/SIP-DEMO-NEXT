"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Trash2, RotateCcw, Download, Eye, X } from "lucide-react";
import { StageBadge } from "@/components/leads/stage-badge";
import { SourceBadge } from "@/components/leads/source-badge";
import { TemperatureBadge } from "@/components/leads/temperature-badge";
import { LeadAvatar } from "@/components/leads/lead-avatar";
import type { leads } from "@/lib/db/schema";
import { bulkDeleteLeadsAction, restoreLeadAction, softDeleteLeadAction, permanentDeleteLeadAction } from "./actions";
import { describeNextActionDetailed } from "@/lib/leads/workflow";
import { formatDate } from "@/lib/format-date";

type Lead = typeof leads.$inferSelect;

export function LeadsTable({
  leads: rows,
  trash,
  onChanged,
}: {
  leads: Lead[];
  trash: boolean;
  /** Called after any mutation (delete/restore/bulk-delete) so a client-side data source (e.g. the live search/filter explorer) can refetch — server-side revalidatePath alone doesn't reach a client-held query cache. */
  onChanged?: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const allSelected = rows.length > 0 && selected.size === rows.length;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleBulkDelete() {
    const ids = Array.from(selected);
    startTransition(async () => {
      await bulkDeleteLeadsAction(ids);
      setSelected(new Set());
      onChanged?.();
    });
  }

  return (
    <div>
      {selected.size > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-[color-mix(in_oklch,var(--primary)_30%,var(--border))] bg-[color-mix(in_oklch,var(--primary)_6%,transparent)] px-3.5 py-2.5 text-xs">
          <span className="tnum font-semibold text-[var(--primary)]">{selected.size} selected</span>
          <a
            href={`/api/leads/export?ids=${Array.from(selected).join(",")}`}
            className="ml-auto flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            <Download className="size-3.5" />
            Export selected
          </a>
          {!trash && (
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={isPending}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20 disabled:opacity-60"
            >
              <Trash2 className="size-3.5" />
              Delete
            </button>
          )}
        </div>
      )}

      <div className="card-surface overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full text-[13px]">
        <thead className="bg-muted/60">
          <tr className="border-b border-border text-left text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            <th className="w-8 px-4 py-3">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} className="size-3.5" />
            </th>
            <th className="px-4 py-3.5">Contact</th>
            <th className="px-4 py-3.5">Company</th>
            <th className="px-4 py-3.5">Phone</th>
            <th className="px-4 py-3.5">Stage / Source</th>
            <th className="px-4 py-3.5">Next Action</th>
            <th className="px-4 py-3.5 text-right">Updated</th>
            <th className="px-4 py-3.5 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((lead) => {
            const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "–";
            const nextAction = describeNextActionDetailed(lead);
            return (
              <tr key={lead.id} className="row-hover border-b border-border last:border-0">
                <td className="px-4 py-3.5">
                  <input type="checkbox" checked={selected.has(lead.id)} onChange={() => toggleOne(lead.id)} className="size-3.5" />
                </td>
                <td className="px-4 py-3.5">
                  <Link href={`/leads/${lead.id}`} className="flex items-center gap-2.5">
                    <LeadAvatar firstName={lead.firstName} lastName={lead.lastName} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-foreground hover:underline">{name}</span>
                      {lead.email && <span className="block truncate text-xs text-muted-foreground">{lead.email}</span>}
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-3.5 text-foreground">{lead.company || "–"}</td>
                <td className="px-4 py-3.5 text-muted-foreground">{lead.phone || "–"}</td>
                <td className="px-4 py-3.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StageBadge stage={lead.stage} />
                    <SourceBadge source={lead.source} />
                  </div>
                  {lead.temperature && (
                    <div className="mt-1">
                      <TemperatureBadge temperature={lead.temperature} />
                    </div>
                  )}
                </td>
                <td className="px-4 py-3.5">
                  <p className="font-medium text-foreground">{nextAction.label}</p>
                  <p className="text-xs text-muted-foreground">{nextAction.detail}</p>
                </td>
                <td className="px-4 py-3.5 text-right text-xs text-muted-foreground">{formatDate(new Date(lead.updatedAt))}</td>
                <td className="px-4 py-3.5">
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={`/leads/${lead.id}`}
                      className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      aria-label="View lead"
                    >
                      <Eye className="size-3.5" />
                    </Link>
                    {trash ? (
                      <>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => startTransition(async () => {
                            await restoreLeadAction(lead.id);
                            onChanged?.();
                          })}
                          className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60"
                          aria-label="Restore lead"
                        >
                          <RotateCcw className="size-3.5" />
                        </button>
                        <PermanentDeleteButton leadId={lead.id} onDeleted={onChanged} />
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => startTransition(async () => {
                          await softDeleteLeadAction(lead.id);
                          onChanged?.();
                        })}
                        className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-60"
                        aria-label="Delete lead"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}

function PermanentDeleteButton({ leadId, onDeleted }: { leadId: string; onDeleted?: () => void }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (!confirm("Permanently delete this lead? This cannot be undone.")) return;
        startTransition(async () => {
          await permanentDeleteLeadAction(leadId);
          onDeleted?.();
        });
      }}
      className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-60"
      aria-label="Permanently delete lead"
    >
      <X className="size-3.5" />
    </button>
  );
}
