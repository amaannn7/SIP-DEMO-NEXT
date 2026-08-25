"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { ReportRangePreset } from "@/lib/reports/date-range";

const PRESETS: { value: ReportRangePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "this_week", label: "This week" },
  { value: "this_month", label: "This month" },
];

export function RangeFilter({ activePreset }: { activePreset: ReportRangePreset }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setPreset = (preset: ReportRangePreset) => {
    const params = new URLSearchParams(searchParams);
    params.set("range", preset);
    params.delete("from");
    params.delete("to");
    router.push(`${pathname}?${params.toString()}`);
  };

  const setCustomRange = (from: string, to: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("range", "custom");
    params.set("from", from);
    params.set("to", to);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map((preset) => (
        <button
          key={preset.value}
          type="button"
          onClick={() => setPreset(preset.value)}
          className={cn(
            "h-9 rounded-full border px-4 text-xs font-semibold transition-colors",
            activePreset === preset.value
              ? "border-transparent text-white shadow-[0_2px_8px_-2px_color-mix(in_oklch,var(--primary)_45%,transparent)]"
              : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
          style={activePreset === preset.value ? { background: "var(--primary)" } : undefined}
        >
          {preset.label}
        </button>
      ))}
      <div className="ml-1 flex items-center gap-1.5 rounded-xl border border-border bg-card px-2 py-1">
        <input
          type="date"
          defaultValue={searchParams.get("from") ?? ""}
          onChange={(e) => {
            const to = searchParams.get("to") || e.target.value;
            setCustomRange(e.target.value, to);
          }}
          className="h-7 rounded-md border-0 bg-transparent px-1.5 text-xs text-foreground outline-none focus:text-[var(--primary)]"
        />
        <span className="text-xs text-muted-foreground">to</span>
        <input
          type="date"
          defaultValue={searchParams.get("to") ?? ""}
          onChange={(e) => {
            const from = searchParams.get("from") || e.target.value;
            setCustomRange(from, e.target.value);
          }}
          className="h-7 rounded-md border-0 bg-transparent px-1.5 text-xs text-foreground outline-none focus:text-[var(--primary)]"
        />
      </div>
    </div>
  );
}
