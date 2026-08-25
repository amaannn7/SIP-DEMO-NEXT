import { cn } from "@/lib/utils";

const SOURCE_CONFIG: Record<string, { label: string; className: string }> = {
  manual: { label: "Manual", className: "border-border text-muted-foreground" },
  import: { label: "Imported", className: "border-border text-muted-foreground" },
  inbound: { label: "Inbound", className: "border-[var(--accent)]/40 text-[var(--accent)]" },
  other: { label: "Other", className: "border-border text-muted-foreground" },
};

/** Pairs with StageBadge in list rows — ports the source system's Stage/Source badge combo. */
export function SourceBadge({ source }: { source: string }) {
  const config = SOURCE_CONFIG[source] ?? SOURCE_CONFIG.other;
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium", config.className)}>
      {config.label}
    </span>
  );
}
