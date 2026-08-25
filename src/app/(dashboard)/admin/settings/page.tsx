import Link from "next/link";
import { Target, KeyRound, UserCog, ArrowRight } from "lucide-react";
import { Topbar } from "@/components/layout/topbar";
import { requireRoleForPage } from "@/lib/auth/session";
import {
  listIcpFieldRows,
  getFitGradeThresholds,
  getBrandContext,
  getAiProviderPreference,
  listMaskedApiKeys,
} from "@/lib/db/queries/org-settings";
import { getOrgDefaultDailyTargets } from "@/lib/db/queries/daily-targets";
import { getAircallSettingsView } from "@/lib/db/queries/aircall-settings";
import { IcpFieldRow } from "./icp-field-row";
import { NewIcpFieldForm } from "./new-icp-field-form";
import { ThresholdsForm } from "./thresholds-form";
import { ApiKeysManager } from "./api-keys-manager";
import { BrandContextForm } from "./brand-context-form";
import { OrgTargetsForm } from "./org-targets-form";
import { ResetOrgDataCard } from "./reset-org-data-card";
import { AircallSettingsCard } from "./aircall-settings-card";

/**
 * Consolidated Settings page — ports the source system's single-page Admin
 * Panel (AI Provider, ICP/scoring config, Team Daily Targets all together as
 * distinct cards) rather than this rebuild's earlier split across three
 * separate routes under /admin. Settings is also its own top-level nav item
 * here, matching the source system, not nested under the dashboard.
 */
export default async function SettingsPage() {
  const session = await requireRoleForPage("super_admin");

  const [fields, thresholds, brandContext, preferredProvider, apiKeys, dailyTargets, aircallSettings] = await Promise.all([
    listIcpFieldRows(session.user.orgId),
    getFitGradeThresholds(session.user.orgId),
    getBrandContext(session.user.orgId),
    getAiProviderPreference(session.user.orgId),
    listMaskedApiKeys(session.user.orgId),
    getOrgDefaultDailyTargets(session.user.orgId),
    getAircallSettingsView(session.user.orgId),
  ]);

  const totalWeight = fields.filter((f) => f.isEnabled).reduce((sum, f) => sum + f.weight, 0);

  return (
    <>
      <Topbar title="Settings" subtitle="AI providers, brand context, scoring rules, and team targets" />

      {/* `items-start`: the AI-provider card is much shorter than Brand context
          and was being stretched to match it, leaving a large dead area. */}
      <div className="grid grid-cols-1 items-start gap-5 p-6 lg:grid-cols-2">
        <div className="card-surface rounded-xl border border-border bg-card p-5">
          <div className="mb-1 flex items-center gap-2">
            <KeyRound className="size-4 text-muted-foreground" />
            <h3 className="text-[15px] font-semibold tracking-tight text-foreground">AI provider</h3>
          </div>
          <p className="mb-4 text-[11px] text-muted-foreground">
            At least one provider needs a key configured for AI features to work. Keys are encrypted at rest.
          </p>
          <ApiKeysManager keys={apiKeys} preferredProvider={preferredProvider} />
        </div>

        <div className="card-surface rounded-xl border border-border bg-card p-5">
          <h3 className="mb-1 text-[15px] font-semibold tracking-tight text-foreground">Brand context</h3>
          <p className="mb-4 text-[11px] text-muted-foreground">
            Injected into every AI-generated research brief, email, and call pitch so output speaks in this
            organization&rsquo;s voice.
          </p>
          <BrandContextForm brandContext={brandContext} />
        </div>

        <div className="card-surface rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <div className="mb-1 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="size-4 text-muted-foreground" />
              <h3 className="text-[15px] font-semibold tracking-tight text-foreground">ICP fields</h3>
            </div>
            <span
              className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                totalWeight === 100 ? "bg-success/15 text-success" : "bg-warning/20 text-warning-foreground"
              }`}
            >
              Total weight: {totalWeight}
            </span>
          </div>
          <p className="mb-4 text-[11px] text-muted-foreground">
            Each field&rsquo;s weight is the maximum points a lead can earn from it. Weights typically total 100 so
            the fit score reads as a percentage.
          </p>
          <div className="divide-y divide-border">
            {fields.map((field) => (
              <IcpFieldRow key={field.key} field={field} />
            ))}
          </div>
          <div className="mt-3">
            <NewIcpFieldForm />
          </div>
        </div>

        <div className="card-surface rounded-xl border border-border bg-card p-5">
          <h3 className="mb-1 text-[15px] font-semibold tracking-tight text-foreground">Grade thresholds</h3>
          <p className="mb-4 text-[11px] text-muted-foreground">
            Fit score ranges that map to grades A, B, C, and Disqualified.
          </p>
          <ThresholdsForm thresholds={thresholds} />
        </div>

        <div className="card-surface rounded-xl border border-border bg-card p-5">
          <h3 className="mb-1 text-[15px] font-semibold tracking-tight text-foreground">Team daily targets</h3>
          <p className="mb-4 text-[11px] text-muted-foreground">
            Default calls/emails/research quotas for reps who haven&rsquo;t set their own on their Commitments page.
          </p>
          <OrgTargetsForm targets={dailyTargets} />
        </div>

        <Link
          href="/my-context"
          className="card-surface flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-5 transition-colors hover:border-[var(--primary)]/40"
        >
          <div>
            <div className="mb-1 flex items-center gap-2">
              <UserCog className="size-4 text-muted-foreground" />
              <h3 className="text-[15px] font-semibold tracking-tight text-foreground">My Context</h3>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Your own sender identity, tone, and signature, used whenever you generate an email or call pitch.
            </p>
          </div>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>

        {/* Aircall is visible to any admin, but only super_admin can actually
            edit its config (canConfigure) — matches the source system's
            visibility, everything else below stays super-admin-only. */}
        <AircallSettingsCard settings={aircallSettings} orgId={session.user.orgId} canConfigure={session.user.role === "super_admin"} />
        {session.user.role === "super_admin" && <ResetOrgDataCard />}
      </div>
    </>
  );
}
