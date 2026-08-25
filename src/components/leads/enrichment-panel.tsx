"use client";

import { useState } from "react";
import { ClipboardCopy, Check, ExternalLink, Building2, TrendingUp, Users, Target } from "lucide-react";
import type { enrichmentResults } from "@/lib/db/schema";
import { enrichmentResultSchema, type EnrichmentResultPayload } from "@/lib/ai/prompts/enrichment";

type EnrichmentRow = typeof enrichmentResults.$inferSelect;

/** Plain-text digest — ports the source system's copyResearch() sections (Company Profile, Industry Challenges, Prospect Analysis, Sales Strategy). */
function buildResearchSummary(data: EnrichmentResultPayload): string {
  const lines: string[] = [];
  const { company_profile, industry_intelligence, prospect_analysis, sales_strategy } = data;

  if (company_profile.description) lines.push("COMPANY PROFILE", company_profile.description, "");
  if (industry_intelligence.top_challenges.length > 0) {
    lines.push("INDUSTRY CHALLENGES", ...industry_intelligence.top_challenges.map((c) => `- ${c.challenge}: ${c.impact}`), "");
  }
  if (prospect_analysis.pain_points.length > 0) {
    lines.push("PROSPECT ANALYSIS", ...prospect_analysis.pain_points.map((p) => `- ${p.pain}: ${p.evidence}`), "");
  }
  if (sales_strategy.opening_hooks.length > 0) {
    lines.push("SALES STRATEGY", ...sales_strategy.opening_hooks.map((h) => `- ${h.hook}: ${h.why}`), "");
  }
  return lines.join("\n").trim();
}

/**
 * Ports the source system's card-grid structure — four boxed cards (Company
 * Profile, Industry Challenges, Prospect Analysis, Sales Strategy) rather
 * than one long flowing card with every sub-array unrolled into its own
 * stacked section one after another — but restyled as its own best version
 * rather than a literal skin: each card gets a distinct accent color so the
 * four read as separate scannable zones at a glance rather than four
 * identically-styled boxes, and content is condensed to the same fields the
 * source system shows (not an exhaustive dump of every sub-array the model
 * returns). Sources stay above the grid (right under the score) rather than
 * at the very bottom, since a rep checking credibility shouldn't have to
 * scroll past the whole brief first.
 */
export function EnrichmentPanel({ enrichment }: { enrichment: EnrichmentRow }) {
  const [copied, setCopied] = useState(false);

  const parsed = enrichmentResultSchema.safeParse({
    research_score: { score: enrichment.researchScore ?? 0, quality: enrichment.researchQuality ?? "", factors: enrichment.researchFactors },
    sources: enrichment.sources,
    company_profile: enrichment.companyProfile,
    industry_intelligence: enrichment.industryIntelligence,
    prospect_analysis: enrichment.prospectAnalysis,
    sales_strategy: enrichment.salesStrategy,
  });

  if (!parsed.success) return null;
  const data: EnrichmentResultPayload = parsed.data;
  const { research_score, sources, company_profile, industry_intelligence, prospect_analysis, sales_strategy } = data;

  const scoreTier = research_score.score >= 70 ? "high" : research_score.score >= 40 ? "medium" : "low";
  const scoreTone = scoreTier === "high" ? "var(--success)" : scoreTier === "medium" ? "var(--warning)" : "var(--muted-foreground)";

  function copyResearch() {
    navigator.clipboard.writeText(buildResearchSummary(data)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="card-surface rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Research score circle — ports the source system's colored score
              display (score>=70 high / >=40 medium / else low). */}
          <div
            className="flex size-12 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold"
            style={{ borderColor: scoreTone, color: scoreTone }}
          >
            {research_score.score}
          </div>
          <div>
            <h3 className="text-[15px] font-semibold tracking-tight text-foreground">Research brief</h3>
            {research_score.quality && <p className="text-xs text-muted-foreground capitalize">{research_score.quality} quality</p>}
          </div>
        </div>
        <button
          type="button"
          onClick={copyResearch}
          className="flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted hover:border-[var(--primary)]/40"
        >
          {copied ? <Check className="size-3.5 text-success" /> : <ClipboardCopy className="size-3.5" />}
          {copied ? "Copied" : "Copy Research"}
        </button>
      </div>

      {research_score.factors.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {research_score.factors.map((f) => (
            <span key={f} className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              {f}
            </span>
          ))}
        </div>
      )}

      {sources.length > 0 && (
        <div className="mb-5 rounded-lg border border-border bg-muted/30 p-3.5">
          <h4 className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            Sources ({sources.length})
          </h4>
          <ul className="space-y-2">
            {sources.map((s) => (
              <li key={s.url}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-start gap-1.5 text-[13px] text-[var(--primary)] hover:underline"
                >
                  <ExternalLink className="mt-0.5 size-3.5 shrink-0" />
                  <span>
                    <span className="font-medium">{s.title}</span>
                    {s.description && <span className="text-muted-foreground"> · {s.description}</span>}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ResearchCard icon={Building2} title="Company Profile" accent="var(--chart-1)">
          {company_profile.description && <p className="text-[13px] leading-relaxed text-foreground/90">{company_profile.description}</p>}
          {company_profile.key_products_services.length > 0 && <CardList items={company_profile.key_products_services} />}
          <Highlight label="Growth stage" value={company_profile.growth_stage || "Unknown"} />
        </ResearchCard>

        <ResearchCard icon={TrendingUp} title="Industry Challenges" accent="var(--chart-2)">
          <CardList
            items={industry_intelligence.top_challenges.map((c) => (
              <>
                <span className="font-semibold text-foreground">{c.challenge}</span>
                <span className="text-foreground/70"> · {c.impact}</span>
              </>
            ))}
          />
        </ResearchCard>

        <ResearchCard icon={Users} title="Prospect Analysis" accent="var(--chart-3)">
          <CardList
            items={prospect_analysis.pain_points.map((p) => (
              <>
                <span className="font-semibold text-foreground">{p.pain}</span>
                <span className="text-foreground/70"> · {p.evidence}</span>
              </>
            ))}
          />
          <Highlight label="Buying power" value={prospect_analysis.buying_power || "Unknown"} />
        </ResearchCard>

        <ResearchCard icon={Target} title="Sales Strategy" accent="var(--chart-4)">
          <CardList
            items={sales_strategy.opening_hooks.map((h) => (
              <>
                <span className="font-semibold text-foreground">{h.hook}</span>
                <span className="text-foreground/70"> · {h.why}</span>
              </>
            ))}
          />
        </ResearchCard>
      </div>
    </div>
  );
}

/** A boxed card with a colored top rule + icon, matching the source system's grid of boxed cards while giving each of the four its own accent so they read as distinct zones rather than four identical boxes. */
function ResearchCard({
  icon: Icon,
  title,
  accent,
  children,
}: {
  icon: React.ElementType;
  title: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="h-[3px] w-full" style={{ background: accent }} />
      <div className="p-3.5">
        <div className="mb-2.5 flex items-center gap-1.5">
          <Icon className="size-3.5 shrink-0" style={{ color: accent }} />
          <h4 className="text-[11px] font-bold tracking-wide text-foreground uppercase">{title}</h4>
        </div>
        <div className="space-y-2.5">{children}</div>
      </div>
    </div>
  );
}

/** A bulleted list of one-line entries, hairline-divided so a dense list of 3-5 items still reads as separate rows rather than a run-on paragraph. */
function CardList({ items }: { items: React.ReactNode[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="divide-y divide-border/60">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-1.5 py-1.5 text-[13px] leading-snug first:pt-0 last:pb-0">
          <span className="mt-0.5 text-muted-foreground">•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** A tinted callout for the one standout fact in a card (growth stage, buying power) — set apart from the list above it instead of blending in as just another line. */
function Highlight({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/60 px-3 py-2">
      <div className="text-[10px] font-bold tracking-wide text-muted-foreground uppercase">{label}</div>
      <div className="text-[13px] font-medium text-foreground">{value}</div>
    </div>
  );
}
