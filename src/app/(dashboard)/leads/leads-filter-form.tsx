"use client";

import { useEffect, useRef, useState } from "react";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";

const TEMPERATURE_FILTERS = ["all", "on_fire", "hot", "warm", "cold"] as const;
const TEMPERATURE_LABELS: Record<string, string> = { all: "All temperatures", on_fire: "Priority", hot: "Hot", warm: "Warm", cold: "Cold" };

type FilterOverrides = { search?: string; temperature?: string; ownerId?: string; page?: number };

/**
 * Pure controlled inputs now — no <form>/navigation of its own. Every
 * change calls `onApply` with just the overridden field(s); the parent
 * LeadsExplorer owns the actual filter state and fetch, so this component
 * only needs to report what changed, matching the pattern already used by
 * the stage strip and pagination controls next to it.
 */
export function LeadsFilterForm({
  search,
  temperature,
  ownerId,
  isManager,
  reps,
  onApply,
}: {
  search: string;
  stage: string;
  temperature: string;
  ownerId: string;
  trash: boolean;
  isManager: boolean;
  reps: { id: string; displayName: string }[];
  onApply: (overrides: FilterOverrides) => void;
}) {
  const [searchValue, setSearchValue] = useState(search);
  const debouncedSearch = useDebouncedValue(searchValue, 300);
  // Compares against the last value THIS component actually applied, rather
  // than a "have I rendered before" ref flag — that kind of call-count guard
  // gets tripped up by React 18 StrictMode's dev-only mount->cleanup->mount
  // double-invoke (either firing an extra spurious apply, or suppressing a
  // later genuinely-real one, depending on which way the flag resets). See
  // the identical fix in TopbarSearch for the full reasoning.
  const lastApplied = useRef(search);

  useEffect(() => {
    if (debouncedSearch === lastApplied.current) return;
    lastApplied.current = debouncedSearch;
    onApply({ search: debouncedSearch, page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally reacts to debouncedSearch only
  }, [debouncedSearch]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="search"
        value={searchValue}
        onChange={(e) => setSearchValue(e.target.value)}
        placeholder="Search name, company, email…"
        className="h-8 w-56 rounded-md border border-input bg-background px-3 text-xs outline-none transition-all placeholder:text-muted-foreground focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10"
      />
      <select
        value={temperature}
        onChange={(e) => onApply({ temperature: e.target.value, page: 1 })}
        className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground outline-none focus:border-[var(--primary)]"
      >
        {TEMPERATURE_FILTERS.map((t) => (
          <option key={t} value={t}>
            {TEMPERATURE_LABELS[t]}
          </option>
        ))}
      </select>
      {isManager && (
        <select
          value={ownerId}
          onChange={(e) => onApply({ ownerId: e.target.value, page: 1 })}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground outline-none focus:border-[var(--primary)]"
        >
          <option value="all">All reps</option>
          {reps.map((rep) => (
            <option key={rep.id} value={rep.id}>
              {rep.displayName}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
