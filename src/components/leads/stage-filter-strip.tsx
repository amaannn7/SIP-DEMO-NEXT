import Link from "next/link";
import { cn } from "@/lib/utils";
import { STAGE_LABELS, STAGE_ORDER } from "@/lib/leads/stages";
import type { leadStageEnum } from "@/lib/db/schema";

type LeadStage = (typeof leadStageEnum.enumValues)[number];

/**
 * Card-strip labels. The full STAGE_LABELS names ("Consultation Booked",
 * "Nurture / Parked") don't fit a narrow filter card and were truncating to
 * "Consultation B…", so the strip uses shortened names. The badge on a lead row
 * still shows the full label.
 */
const STAGE_SHORT_LABELS: Partial<Record<LeadStage, string>> = {
  consultation_booked: "Consultation",
  nurture_parked: "Nurture",
  call_attempted: "Call Made",
};

/** One-line description shown under each stage count — ports the source system's Pipeline stage cards. */
const STAGE_SUBTITLES: Record<LeadStage, string> = {
  new_lead: "Needs triage",
  research: "Build context",
  email_sent: "Awaiting response",
  call_attempted: "Outcome required",
  engaged: "Live opportunity",
  consultation_booked: "Meeting set",
  nurture_parked: "Parked or reject",
  won: "Closed won",
  lost: "Closed lost",
};

/**
 * Each stage carries the same token color as its StageBadge, so a stage reads
 * identically whether it appears here as a filter card or inline on a lead row.
 */
const STAGE_TONES: Record<LeadStage, string> = {
  new_lead: "var(--temp-cold)",
  research: "var(--chart-3)",
  email_sent: "var(--warning)",
  call_attempted: "var(--primary)",
  engaged: "var(--accent)",
  consultation_booked: "var(--primary)",
  nurture_parked: "var(--temp-cold)",
  won: "var(--success)",
  lost: "var(--destructive)",
};

/**
 * Clickable stage-count cards, ports the source system's Pipeline header —
 * each stage is a card with a count and a one-line description, not a pill
 * filter strip.
 */
export function StageFilterStrip({
  activeStage,
  counts,
  total,
  buildHref,
}: {
  activeStage: string;
  counts: Partial<Record<LeadStage, number>>;
  total: number;
  buildHref: (stage: string) => string;
}) {
  return (
    // 10 cards total (All Leads + 9 stages). Previously capped at 5 across
    // starting from `lg`, which — with the sidebar expanded eating ~256px —
    // squeezed every card to its truncation point on ordinary laptop widths.
    // Adds an `xl` step so wide screens get all 10 on one row, and backs off
    // to 4 (not 5) at `lg` so cards keep real width instead of hitting the
    // same crowding on medium screens or a still-expanded sidebar.
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      <StageCard
        href={buildHref("all")}
        label="All Leads"
        subtitle="Whole book"
        count={total}
        tone="var(--primary)"
        active={activeStage === "all"}
      />
      {STAGE_ORDER.map((stage) => (
        <StageCard
          key={stage}
          href={buildHref(stage)}
          label={STAGE_SHORT_LABELS[stage] ?? STAGE_LABELS[stage]}
          fullLabel={STAGE_LABELS[stage]}
          subtitle={STAGE_SUBTITLES[stage]}
          count={counts[stage] ?? 0}
          tone={STAGE_TONES[stage]}
          active={activeStage === stage}
        />
      ))}
    </div>
  );
}

function StageCard({
  href,
  label,
  fullLabel,
  subtitle,
  count,
  tone,
  active,
}: {
  href: string;
  label: string;
  /** Full stage name, used for the tooltip when `label` is a shortened form. */
  fullLabel?: string;
  subtitle: string;
  count: number;
  tone: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        // `cursor-pointer` is implicit for an <a>, but the stronger tell that
        // this is clickable is the hover/focus state: a lift, a deepened
        // shadow, and a border that shifts to the stage's own tone (via the
        // --tone custom property set below) rather than a faint background
        // wash. Every pixel of the card is the link — there's no separate
        // click target — so the affordance just needed to be visible, for
        // both mouse hover and keyboard focus.
        "card-surface group relative overflow-hidden rounded-xl border p-3.5 pt-4 transition-all duration-150",
        active
          ? "border-transparent ring-2 ring-[var(--primary)]"
          : "border-border bg-card hover:-translate-y-0.5 hover:border-[var(--tone)] hover:shadow-md focus-visible:-translate-y-0.5 focus-visible:border-[var(--tone)] focus-visible:shadow-md focus-visible:outline-none",
      )}
      style={
        {
          "--tone": tone,
          ...(active ? { background: `color-mix(in oklch, ${tone} 8%, var(--card))` } : {}),
        } as React.CSSProperties
      }
    >
      {/* Stage's own color as a top edge — makes the strip scannable as a
          pipeline rather than ten identical grey boxes. */}
      <span
        className="absolute inset-x-0 top-0 h-1 transition-opacity"
        style={{ background: tone, opacity: active ? 1 : 0.45 }}
        aria-hidden
      />
      <p className="truncate text-[11px] font-medium text-muted-foreground" title={fullLabel ?? label}>
        {label}
      </p>
      <p
        className="tnum mt-1.5 text-2xl font-bold tracking-tight"
        style={{ color: active ? tone : "var(--foreground)" }}
      >
        {count}
      </p>
      <p className="mt-0.5 truncate text-[10px] text-muted-foreground" title={subtitle}>
        {subtitle}
      </p>
    </Link>
  );
}
