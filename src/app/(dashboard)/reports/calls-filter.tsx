"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { CALL_OUTCOME_OPTIONS } from "@/lib/calls/outcomes";

export function CallsFilter({ reps }: { reps: { id: string; displayName: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        defaultValue={searchParams.get("repId") ?? ""}
        onChange={(e) => setParam("repId", e.target.value)}
        className="h-9 rounded-lg border border-input bg-card px-3 text-xs text-foreground outline-none transition-all focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--primary)]/12"
      >
        <option value="">All reps</option>
        {reps.map((rep) => (
          <option key={rep.id} value={rep.id}>
            {rep.displayName}
          </option>
        ))}
      </select>

      <select
        defaultValue={searchParams.get("outcome") ?? ""}
        onChange={(e) => setParam("outcome", e.target.value)}
        className="h-9 rounded-lg border border-input bg-card px-3 text-xs text-foreground outline-none transition-all focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--primary)]/12"
      >
        <option value="">All outcomes</option>
        {CALL_OUTCOME_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
