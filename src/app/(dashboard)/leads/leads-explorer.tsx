"use client";

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Upload, Download, Users2, Trash2, Archive, Table2, KanbanSquare } from "lucide-react";
import { StageFilterStrip } from "@/components/leads/stage-filter-strip";
import { Skeleton } from "@/components/shared/skeleton";
import { cn } from "@/lib/utils";
import { STAGE_ORDER } from "@/lib/leads/stages";
import type { leads, leadStageEnum } from "@/lib/db/schema";
import { LeadsTable } from "./leads-table";
import { LeadsFilterForm } from "./leads-filter-form";
import { EmptyTrashButton } from "./empty-trash-button";
import { LeadsKanbanBoard } from "./kanban/leads-kanban-board";

type Lead = typeof leads.$inferSelect;
type LeadStage = (typeof leadStageEnum.enumValues)[number];

type LeadsResponse = {
  leads: Lead[];
  pagination: { page: number; perPage: number; total: number; pages: number };
  stageCounts: Partial<Record<LeadStage, number>>;
};

// Every timestamp column on `leads` — JSON.stringify (NextResponse.json)
// serializes Date objects to strings, and fetch/JSON.parse never revives
// them back. listLeads() used to run server-side and hand LeadsTable real
// Date objects directly (a Server Component can pass them through props
// unserialized); now that the data crosses a real HTTP/JSON boundary via
// /api/leads, every one of these needs reviving explicitly or consumers
// like describeNextActionDetailed (which calls .getFullYear() etc. on
// followupDate) break at runtime on what's actually a string.
const LEAD_DATE_FIELDS = ["scoresUpdatedAt", "followupDate", "skippedUntil", "lastActivityAt", "deletedAt", "createdAt", "updatedAt"] as const;

function reviveLeadDates(lead: Lead): Lead {
  const revived = { ...lead };
  for (const field of LEAD_DATE_FIELDS) {
    const value = revived[field];
    if (typeof value === "string") {
      (revived as unknown as Record<string, Date>)[field] = new Date(value);
    }
  }
  return revived;
}

type Filters = { search: string; stage: string; temperature: string; ownerId: string; page: number; trash: boolean };
type ViewMode = "table" | "board";

// The board shows every stage as a column at once, so it needs the whole
// active pipeline in one call rather than one paginated page of 25 — the
// table's default perPage. Comfortably covers a single org's pipeline without
// needing real pagination inside a column; countLeadsByStage's per-stage
// counts stay the source of truth for anything larger.
const BOARD_PER_PAGE = 500;

/**
 * Owns the whole Leads list interaction — filters, stage strip, table,
 * pagination — as one client-side piece backed by TanStack Query instead of
 * the previous full Server Component page. Filter changes now fetch quietly
 * in the background (no page re-navigation, no flash of the whole page
 * re-rendering); the URL is still kept in sync via router.replace so the
 * view stays bookmarkable and the back button still works, it just doesn't
 * drive the fetch directly anymore.
 */
export function LeadsExplorer({ isManager, reps }: { isManager: boolean; reps: { id: string; displayName: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const view: ViewMode = searchParams.get("view") === "board" ? "board" : "table";

  const filters: Filters = useMemo(
    () => ({
      search: searchParams.get("search") ?? "",
      stage: searchParams.get("stage") ?? "all",
      temperature: searchParams.get("temperature") ?? "all",
      ownerId: searchParams.get("ownerId") ?? "all",
      page: Number(searchParams.get("page") ?? "1"),
      trash: searchParams.get("trash") === "true",
    }),
    [searchParams],
  );

  // Board mode needs every active stage's leads in one shot (to render as
  // columns) rather than one paginated page, so `view` is part of the key —
  // keeping page 1 of the table cached separately from the board's larger
  // perPage avoids one clobbering the other on view switch. Both still share
  // the ["leads-list"] prefix so a single invalidateQueries({queryKey:
  // ["leads-list"]}) (bulk delete/restore, the stage-drag mutation) reaches
  // whichever view is mounted.
  const queryKey = ["leads-list", view, filters] as const;

  const { data, isPending } = useQuery<LeadsResponse>({
    queryKey,
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (filters.search) qs.set("search", filters.search);
      if (filters.stage !== "all") qs.set("stage", filters.stage);
      if (filters.temperature !== "all") qs.set("temperature", filters.temperature);
      if (filters.ownerId !== "all") qs.set("ownerId", filters.ownerId);
      if (view === "board") {
        qs.set("perPage", String(BOARD_PER_PAGE));
      } else if (filters.page > 1) {
        qs.set("page", String(filters.page));
      }
      if (filters.trash) qs.set("trash", "true");
      const res = await fetch(`/api/leads?${qs.toString()}`);
      if (!res.ok) throw new Error("Failed to load leads");
      const json: LeadsResponse = await res.json();
      return { ...json, leads: json.leads.map(reviveLeadDates) };
    },
    // Keep showing the previous page's rows while the next query resolves —
    // this is what actually makes typing feel instant instead of flashing
    // to an empty/loading table on every fetch.
    placeholderData: (previous) => previous,
  });

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["leads-list"] });
  }, [queryClient]);

  /** Pushes new filter values into the URL (shallow, no page reload) without itself triggering the fetch — the useQuery above reacts to the resulting searchParams change on its own. */
  const applyFilters = useCallback(
    (overrides: Partial<Filters>) => {
      const next: Filters = { ...filters, ...overrides };
      const qs = new URLSearchParams();
      if (next.search) qs.set("search", next.search);
      if (next.stage !== "all") qs.set("stage", next.stage);
      if (next.temperature !== "all") qs.set("temperature", next.temperature);
      if (next.ownerId !== "all") qs.set("ownerId", next.ownerId);
      if (next.page > 1) qs.set("page", String(next.page));
      if (next.trash) qs.set("trash", "true");
      if (view === "board") qs.set("view", "board");
      router.replace(`${pathname}?${qs.toString()}`, { scroll: false });
    },
    [filters, pathname, router, view],
  );

  const setView = useCallback(
    (next: ViewMode) => {
      const qs = new URLSearchParams(searchParams.toString());
      // The board always shows every stage side by side, so a stage filter
      // (from a StageFilterStrip click, say) would just hide the other 8
      // columns for no benefit — drop it when switching to board view.
      if (next === "board") {
        qs.set("view", "board");
        qs.delete("stage");
        qs.delete("page");
      } else {
        qs.delete("view");
      }
      router.replace(`${pathname}?${qs.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const ownerNameById = useMemo(() => Object.fromEntries(reps.map((r) => [r.id, r.displayName])), [reps]);

  const leadsRows = data?.leads ?? [];
  const pagination = data?.pagination ?? { page: 1, perPage: 25, total: 0, pages: 1 };
  const stageCounts = data?.stageCounts ?? {};
  const totalActive = Object.values(stageCounts).reduce((sum, c) => sum + (c ?? 0), 0);

  return (
    <div className="space-y-5 p-6">
      <p className="-mt-2 text-xs text-muted-foreground">
        {pagination.total} lead{pagination.total === 1 ? "" : "s"}
      </p>

      {/* StageFilterStrip renders real <a> links for accessibility/keyboard
          nav (open-in-new-tab still works via ctrl/cmd-click), but a plain
          click is intercepted here to update state without a full page
          navigation — same instant behavior as the search/temperature/owner
          filters below. */}
      <StageStripInterceptor
        activeStage={filters.trash ? "" : filters.stage}
        counts={stageCounts}
        total={totalActive}
        onSelect={(stage) => applyFilters({ stage, page: 1 })}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <LeadsFilterForm
          search={filters.search}
          stage={filters.stage}
          temperature={filters.temperature}
          ownerId={filters.ownerId}
          trash={filters.trash}
          isManager={isManager}
          reps={reps}
          onApply={applyFilters}
        />

        <div className="flex items-center gap-2">
          {!filters.trash && (
            <div className="flex h-8 items-center rounded-md border border-input bg-background p-0.5">
              <button
                type="button"
                onClick={() => setView("table")}
                aria-pressed={view === "table"}
                className={cn(
                  "flex h-full items-center gap-1.5 rounded px-2.5 text-xs font-medium transition-colors",
                  view === "table" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Table2 className="size-3.5" />
                Table
              </button>
              <button
                type="button"
                onClick={() => setView("board")}
                aria-pressed={view === "board"}
                className={cn(
                  "flex h-full items-center gap-1.5 rounded px-2.5 text-xs font-medium transition-colors",
                  view === "board" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <KanbanSquare className="size-3.5" />
                Board
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => applyFilters({ trash: !filters.trash, stage: "all", page: 1 })}
            className="flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            {filters.trash ? <Archive className="size-3.5" /> : <Trash2 className="size-3.5" />}
            {filters.trash ? "Back to leads" : "Trash"}
          </button>
          {filters.trash ? (
            <EmptyTrashButton onEmptied={refetch} />
          ) : (
            <>
              <a
                href="/api/leads/export"
                className="flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted"
              >
                <Download className="size-3.5" />
                Export
              </a>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- static route, matches the plain <a> pattern already used elsewhere on this page */}
              <a
                href="/leads/import"
                className="flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted"
              >
                <Upload className="size-3.5" />
                Import
              </a>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- static route, matches the plain <a> pattern already used elsewhere on this page */}
              <a
                href="/leads/new"
                className="flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium text-white transition-opacity hover:opacity-90"
                style={{ background: "var(--primary)" }}
              >
                <Plus className="size-3.5" />
                Add lead
              </a>
            </>
          )}
        </div>
      </div>

      {view === "board" && !filters.trash ? (
        isPending ? (
          <LeadsBoardSkeleton />
        ) : (
          <LeadsKanbanBoard leads={leadsRows} ownerNameById={isManager ? ownerNameById : undefined} />
        )
      ) : (
        <div className="card-surface overflow-hidden rounded-xl border border-border bg-card">
          {/* isPending (no data yet at all, including the very first render
              before the fetch has even started) must gate the loading state,
              not isFetching — isFetching is false for that brief pre-fetch
              instant, so gating on it flashed the "No leads yet" empty state
              on every fresh mount before real data arrived. */}
          {isPending ? (
            <LeadsTableSkeleton />
          ) : leadsRows.length === 0 ? (
            <EmptyState hasFilters={Boolean(filters.search) || filters.stage !== "all" || filters.temperature !== "all"} trash={filters.trash} />
          ) : (
            <LeadsTable leads={leadsRows} trash={filters.trash} onChanged={refetch} />
          )}
        </div>
      )}

      {view === "table" && pagination.pages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Page {pagination.page} of {pagination.pages}
          </span>
          <div className="flex gap-2">
            {pagination.page > 1 && (
              <button
                type="button"
                onClick={() => applyFilters({ page: pagination.page - 1 })}
                className="rounded-md border border-border px-3 py-1.5 hover:bg-muted"
              >
                Previous
              </button>
            )}
            {pagination.page < pagination.pages && (
              <button
                type="button"
                onClick={() => applyFilters({ page: pagination.page + 1 })}
                className="rounded-md border border-border px-3 py-1.5 hover:bg-muted"
              >
                Next
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StageStripInterceptor({
  activeStage,
  counts,
  total,
  onSelect,
}: {
  activeStage: string;
  counts: Partial<Record<LeadStage, number>>;
  total: number;
  onSelect: (stage: string) => void;
}) {
  return (
    <div
      className="w-full"
      onClickCapture={(e) => {
        const link = (e.target as HTMLElement).closest("a[href]");
        if (!link) return;
        // Plain left-click only — ctrl/cmd/middle-click still open a new tab normally.
        const mouseEvent = e as unknown as React.MouseEvent;
        if (mouseEvent.metaKey || mouseEvent.ctrlKey || mouseEvent.shiftKey || mouseEvent.button === 1) return;
        e.preventDefault();
        const url = new URL(link.getAttribute("href") ?? "", window.location.origin);
        onSelect(url.searchParams.get("stage") ?? "all");
      }}
    >
      <StageFilterStrip activeStage={activeStage} counts={counts} total={total} buildHref={(stage) => `?stage=${stage}`} />
    </div>
  );
}

/** Nine empty stage columns, matching STAGE_ORDER, while the board's first fetch is in flight. */
function LeadsBoardSkeleton() {
  return (
    <div className="flex h-[calc(100vh-260px)] min-h-[420px] gap-3 overflow-x-auto pb-2">
      {STAGE_ORDER.map((stage) => (
        <div key={stage} className="flex h-full w-72 shrink-0 flex-col rounded-xl border border-border bg-muted/30">
          <div className="border-b border-border bg-card p-2.5">
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="flex flex-col gap-2 p-2">
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Matches loading.tsx's row shape — shown during useQuery's isPending window (client-side refetch has no Suspense boundary to trigger that file's fallback). */
function LeadsTableSkeleton() {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="ml-auto h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ hasFilters, trash }: { hasFilters: boolean; trash: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Users2 className="size-5" />
      </div>
      <p className="text-sm font-medium text-foreground">
        {trash ? "Trash is empty" : hasFilters ? "No leads match your filters" : "No leads yet"}
      </p>
      <p className="mt-1 max-w-64 text-xs text-muted-foreground">
        {trash ? "Deleted leads show up here." : hasFilters ? "Try a different search or filter." : "Import a CSV or add a lead to get started."}
      </p>
    </div>
  );
}
