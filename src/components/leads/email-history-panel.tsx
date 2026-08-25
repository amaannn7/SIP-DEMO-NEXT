"use client";

import { useState } from "react";
import { ClipboardCopy, Check, ExternalLink } from "lucide-react";
import type { emailHistory } from "@/lib/db/schema";
import { formatDate } from "@/lib/format-date";
import { EmailOutcomeSelect } from "./email-outcome-select";
import { MarkEmailSentButton } from "./mark-email-sent-button";

type EmailRow = typeof emailHistory.$inferSelect;

const STEP_LABELS: Record<string, string> = {
  initial: "Initial outreach",
  followup1: "Follow-up 1",
  followup2: "Follow-up 2",
  breakup: "Breakup",
};

// Same step descriptions as GenerateEmailAction's hints — a past email in the
// sequence should read as clearly as the picker did when it was generated.
const STEP_HINTS: Record<string, string> = {
  initial: "First outreach",
  followup1: "3-4 days after initial, if no reply",
  followup2: "Final value-add before the breakup email",
  breakup: "Last touch, closes the loop",
};

export function EmailHistoryPanel({ leadId, leadEmail, emails }: { leadId: string; leadEmail: string | null; emails: EmailRow[] }) {
  if (emails.length === 0) return null;

  return (
    <div className="card-surface rounded-xl border border-border bg-card p-5">
      <h3 className="mb-3 text-[15px] font-semibold tracking-tight text-foreground">Generated emails</h3>
      <div className="space-y-3">
        {emails.map((email) => (
          <div key={email.id} className="rounded-lg border border-border p-4">
            <div className="mb-2.5 flex items-start justify-between gap-2">
              <div>
                <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                  {STEP_LABELS[email.sequenceStep] ?? email.sequenceStep}
                  {!email.sentAt && (
                    <span className="rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-warning-foreground normal-case">Draft</span>
                  )}
                </span>
                {STEP_HINTS[email.sequenceStep] && <p className="mt-0.5 text-[11px] text-muted-foreground">{STEP_HINTS[email.sequenceStep]}</p>}
              </div>
              <span className="shrink-0 text-[11px] text-muted-foreground">{formatDate(new Date(email.createdAt))}</span>
            </div>
            {/* Body copy bumped from 12px muted-on-muted to 14px real
                foreground with real line-height — this is generated prose
                a rep has to actually read and send, not metadata. */}
            <div className="mb-3 rounded-md bg-muted/40 p-3.5">
              <p className="mb-2 text-sm font-semibold text-foreground">{email.subject}</p>
              <p className="text-[14px] leading-relaxed whitespace-pre-wrap text-foreground">{email.body}</p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <CopyEmailButton subject={email.subject} body={email.body} />
              <OpenInEmailClientButton to={leadEmail} subject={email.subject} body={email.body} />
              {email.sentAt ? (
                <EmailOutcomeSelect leadId={leadId} emailId={email.id} outcome={email.outcome} />
              ) : (
                <MarkEmailSentButton leadId={leadId} emailId={email.id} />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Ports the source system's copyEmail(): clipboard gets "Subject: X\n\n{body}". */
function CopyEmailButton({ subject, body }: { subject: string; body: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="flex h-7 items-center gap-1.5 rounded-md border border-border px-2.5 text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
    >
      {copied ? <Check className="size-3 text-success" /> : <ClipboardCopy className="size-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

/** Ports the source system's openLeadEmailClient(): builds a mailto: link and opens it in a new tab/the OS mail handler, leaving "Mark as sent" as the separate, explicit confirmation step. */
function OpenInEmailClientButton({ to, subject, body }: { to: string | null; subject: string; body: string }) {
  if (!to) return null;
  const href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return (
    <a
      href={href}
      className="flex h-7 items-center gap-1.5 rounded-md border border-border px-2.5 text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
    >
      <ExternalLink className="size-3" />
      Open in Email Client
    </a>
  );
}
