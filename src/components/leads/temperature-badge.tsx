import { cn } from "@/lib/utils";

// Tinted pill rather than bare text + dot: the temperature is one of the two
// things a rep scans a row for, so it needs a surface of its own. Colors come
// straight from the temp tokens (which have their own dark values) instead of
// the previous `black` mixes, which went muddy on a dark canvas.
const TEMP_CONFIG = {
  on_fire: {
    label: "Priority",
    dot: "bg-[var(--temp-on-fire)]",
    pill: "bg-[color-mix(in_oklch,var(--temp-on-fire)_14%,transparent)] text-[var(--temp-on-fire)]",
  },
  hot: {
    label: "Hot",
    dot: "bg-[var(--temp-hot)]",
    pill: "bg-[color-mix(in_oklch,var(--temp-hot)_14%,transparent)] text-[var(--temp-hot)]",
  },
  warm: {
    label: "Warm",
    dot: "bg-[var(--temp-warm)]",
    pill: "bg-[color-mix(in_oklch,var(--temp-warm)_14%,transparent)] text-[var(--temp-warm)]",
  },
  cold: {
    label: "Cold",
    dot: "bg-[var(--temp-cold)]",
    pill: "bg-[color-mix(in_oklch,var(--temp-cold)_14%,transparent)] text-[var(--temp-cold)]",
  },
} as const;

export type Temperature = keyof typeof TEMP_CONFIG;

export function TemperatureBadge({ temperature }: { temperature: Temperature }) {
  const config = TEMP_CONFIG[temperature];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap",
        config.pill,
      )}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", config.dot)} />
      {config.label}
    </span>
  );
}
