"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { TemperatureBadge, type Temperature } from "@/components/leads/temperature-badge";
import { StageBadge } from "@/components/leads/stage-badge";
import { WORKBENCH_CATEGORIES, type WorkbenchCategory, type WorkbenchLeadItem } from "@/lib/workbench/generate";
import type { LeadStage } from "@/lib/leads/stages";

export function WorkbenchBoard({
  buckets,
  scope,
  isManager,
}: {
  buckets: Record<WorkbenchCategory, WorkbenchLeadItem[]>;
  scope: "mine" | "team";
  isManager: boolean;
}) {
  const [active, setActive] = useState<WorkbenchCategory>(
    WORKBENCH_CATEGORIES.find((c) => buckets[c.key].length > 0)?.key ?? "needs_research",
  );
  const activeItems = buckets[active];
  const activeConfig = WORKBENCH_CATEGORIES.find((c) => c.key === active)!;

  return (
    <div className="space-y-5">
      {isManager && (
        <div className="flex items-center gap-1.5">
          <Link
            href="/workbench?scope=mine"
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              scope === "mine"
                ? "border-[var(--primary)] bg-[color-mix(in_oklch,var(--primary)_10%,transparent)] text-[var(--primary)]"
                : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            My leads
          </Link>
          <Link
            href="/workbench?scope=team"
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              scope === "team"
                ? "border-[var(--primary)] bg-[color-mix(in_oklch,var(--primary)_10%,transparent)] text-[var(--primary)]"
                : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            Team (excluding mine)
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {WORKBENCH_CATEGORIES.map((cat) => {
          const count = buckets[cat.key].length;
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => setActive(cat.key)}
              className={cn(
                "flex flex-col items-start gap-1 rounded-xl border p-4 text-left transition-colors",
                active === cat.key ? "border-[var(--primary)] bg-[color-mix(in_oklch,var(--primary)_6%,transparent)]" : "border-border bg-card hover:bg-muted/50",
              )}
            >
              <div className="flex w-full items-center justify-between">
                <span className="text-[13px] font-semibold text-foreground">{cat.title}</span>
                <span
                  className={cn(
                    "tnum flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold",
                    count > 0 ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "bg-muted text-muted-foreground",
                  )}
                >
                  {count}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">{cat.description}</p>
            </button>
          );
        })}
      </div>

      <div className="card-surface rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-[15px] font-semibold tracking-tight text-foreground">{activeConfig.title}</h3>
            <p className="text-xs text-muted-foreground">{activeItems.length} lead{activeItems.length === 1 ? "" : "s"}</p>
          </div>
          {activeItems.length > 0 && <CategoryAction category={active} items={activeItems} />}
        </div>

        {activeItems.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nothing here right now.</p>
        ) : (
          <div className="divide-y divide-border">
            {activeItems.map((item) => (
              <Link
                key={item.leadId}
                href={`/leads/${item.leadId}`}
                className="flex items-center justify-between gap-3 py-2.5 transition-colors hover:bg-muted/40"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{item.name || "Unnamed lead"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.company}
                    {item.ownerName ? ` · ${item.ownerName}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <StageBadge stage={item.stage as LeadStage} />
                  <TemperatureBadge temperature={item.temperature as Temperature} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Ports the source system's batch actions exactly as they actually behave
 * (verified against the source: none of the 7 "batch" buttons process leads
 * in bulk — every one opens the single top lead in that category, except Hot
 * Focus which filters the main leads list). Labeled honestly here rather
 * than with the source's misleading "Research All"/"Queue Emails" copy,
 * which implied automation the source system never had.
 */
function CategoryAction({ category, items }: { category: WorkbenchCategory; items: WorkbenchLeadItem[] }) {
  if (category === "hot_focus") {
    return (
      <Link
        href="/leads?temperature=hot"
        className="flex h-8 items-center rounded-md bg-[var(--primary)] px-3 text-xs font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90"
      >
        View all in Leads
      </Link>
    );
  }
  return (
    <Link
      href={`/leads/${items[0].leadId}`}
      className="flex h-8 items-center rounded-md bg-[var(--primary)] px-3 text-xs font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90"
    >
      Open next lead
    </Link>
  );
}
