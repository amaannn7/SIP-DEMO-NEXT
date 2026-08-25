import { STAGE_LABELS, type LeadStage } from "@/lib/leads/stages";
import { cn } from "@/lib/utils";

export { STAGE_LABELS };

/**
 * Stage colors are expressed as a `color-mix` over theme tokens rather than
 * hardcoded OKLCH literals, so they track the brand palette and stay legible
 * in dark mode (the previous fixed light-mode values went muddy on a dark
 * canvas). The progression walks the pipeline from neutral -> brand violet ->
 * magenta -> resolved (green/red), so stage reads as forward motion.
 */
const STAGE_STYLES: Record<LeadStage, string> = {
  new_lead: "bg-muted text-muted-foreground",
  research:
    "bg-[color-mix(in_oklch,var(--chart-3)_16%,transparent)] text-[color-mix(in_oklch,var(--chart-3),black_22%)] dark:text-[var(--chart-3)]",
  email_sent:
    "bg-[color-mix(in_oklch,var(--warning)_18%,transparent)] text-[color-mix(in_oklch,var(--warning),black_28%)] dark:text-[var(--warning)]",
  call_attempted:
    "bg-[color-mix(in_oklch,var(--primary)_14%,transparent)] text-[var(--primary)]",
  engaged:
    "bg-[color-mix(in_oklch,var(--accent)_14%,transparent)] text-[var(--accent)]",
  consultation_booked: "bg-primary text-primary-foreground",
  nurture_parked: "bg-muted text-muted-foreground",
  won: "bg-[color-mix(in_oklch,var(--success)_16%,transparent)] text-[var(--success)]",
  lost: "bg-destructive/10 text-destructive",
};

export function StageBadge({ stage }: { stage: LeadStage }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap",
        STAGE_STYLES[stage],
      )}
    >
      {STAGE_LABELS[stage]}
    </span>
  );
}
