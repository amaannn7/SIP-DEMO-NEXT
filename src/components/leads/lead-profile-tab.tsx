"use client";

import { useState } from "react";
import { ClipboardCopy, Check } from "lucide-react";
import type { leads } from "@/lib/db/schema";
import { InlineEditField } from "./inline-edit-field";
import { NextBestActionPanel } from "./next-best-action-panel";
import type { WorkflowStep } from "@/lib/leads/workflow";

type Lead = typeof leads.$inferSelect;

// Ports the source system's copySummary() exactly: 7 fixed, colon-labeled
// lines in this order, always all present even when blank — not a filtered
// list of only the populated fields.
function buildSummary(lead: Lead): string {
  const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ");
  return [
    `Name: ${name}`,
    `Email: ${lead.email ?? ""}`,
    `Phone: ${lead.phone ?? ""}`,
    `Company: ${lead.company ?? ""}`,
    `Title: ${lead.title ?? ""}`,
    `Industry: ${lead.industry ?? ""}`,
    `Country: ${lead.country ?? ""}`,
  ].join("\n");
}

// Ports the source system's link-text trimming — the href keeps the full
// URL, but the visible text drops the scheme/host boilerplate.
function trimLinkedIn(value: string): string {
  return value.replace("https://www.linkedin.com/in/", "").replace("https://linkedin.com/in/", "");
}
function trimWebsite(value: string): string {
  return value.replace("https://www.", "").replace("https://", "");
}

/**
 * Ports the source system's Profile tab: a read-only Contact/Company
 * summary (not an always-editable form) with per-field pencil-icon editing,
 * plus the "Copy Summary" action. Editing is inline/per-field rather than
 * the source system's separate edit flow — a deliberate modernization.
 */
export function LeadProfileTab({ lead, onNavigateToStep }: { lead: Lead; onNavigateToStep: (step: WorkflowStep) => void }) {
  const [copied, setCopied] = useState(false);

  function copySummary() {
    navigator.clipboard.writeText(buildSummary(lead)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="space-y-4">
      <NextBestActionPanel leadId={lead.id} stage={lead.stage} onNavigateToStep={onNavigateToStep} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Contact</p>
          <div className="space-y-3.5">
            <InlineEditField leadId={lead.id} field="firstName" label="First name" value={lead.firstName} />
            <InlineEditField leadId={lead.id} field="lastName" label="Last name" value={lead.lastName} />
            <InlineEditField leadId={lead.id} field="email" label="Email" value={lead.email} type="email" href={(v) => `mailto:${v}`} />
            <InlineEditField leadId={lead.id} field="phone" label="Phone" value={lead.phone} type="tel" href={(v) => `tel:${v}`} />
            <InlineEditField leadId={lead.id} field="linkedin" label="LinkedIn" value={lead.linkedin} type="url" href={(v) => v} displayValue={trimLinkedIn} />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-3 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Company</p>
          <div className="space-y-3.5">
            <InlineEditField leadId={lead.id} field="company" label="Company" value={lead.company} />
            <InlineEditField leadId={lead.id} field="title" label="Title" value={lead.title} />
            <InlineEditField leadId={lead.id} field="industry" label="Industry" value={lead.industry} />
            <InlineEditField leadId={lead.id} field="website" label="Website" value={lead.website} type="url" href={(v) => v} displayValue={trimWebsite} />
            <InlineEditField leadId={lead.id} field="country" label="Country" value={lead.country} />
            <InlineEditField leadId={lead.id} field="companySize" label="Company size" value={lead.companySize} />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <InlineEditField
          leadId={lead.id}
          field="callAnchor"
          label="Note for next contact"
          value={lead.callAnchor}
          multiline
        />
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <InlineEditField leadId={lead.id} field="notes" label="Notes" value={lead.notes} multiline />
      </div>

      <button
        type="button"
        onClick={copySummary}
        className="flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted"
      >
        {copied ? <Check className="size-3.5 text-success" /> : <ClipboardCopy className="size-3.5" />}
        {copied ? "Copied" : "Copy Summary"}
      </button>
    </div>
  );
}
