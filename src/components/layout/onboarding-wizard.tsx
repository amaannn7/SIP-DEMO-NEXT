"use client";

import { useState, useTransition } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { saveSenderProfileAction } from "@/app/(dashboard)/my-context/actions";
import { completeOnboardingAction } from "@/app/(dashboard)/onboarding-actions";

type FormState = {
  senderName: string;
  senderTitle: string;
  senderCompany: string;
  calendarLink: string;
  companyDescription: string;
  valueProposition: string;
  socialProof: string;
};

const inputClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-all placeholder:text-muted-foreground focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10";
const textareaClass =
  "w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-all placeholder:text-muted-foreground focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10";
const labelClass = "mb-1 block text-xs font-medium text-muted-foreground";

/**
 * First-login welcome wizard — ports the source system's 3-step onboarding
 * modal (sender profile -> brand context -> tips). Fields are held in local
 * state across steps and only persisted once, on completion, so a partial
 * step doesn't clobber another via a full-object upsert.
 */
export function OnboardingWizard({ initialName }: { initialName: string }) {
  const [dismissed, setDismissed] = useState(false);
  const [step, setStep] = useState(1);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<FormState>({
    senderName: initialName,
    senderTitle: "",
    senderCompany: "",
    calendarLink: "",
    companyDescription: "",
    valueProposition: "",
    socialProof: "",
  });

  if (dismissed) return null;

  function set<K extends keyof FormState>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function skip() {
    startTransition(async () => {
      await completeOnboardingAction();
      setDismissed(true);
    });
  }

  function finish() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("senderName", form.senderName);
      formData.set("senderTitle", form.senderTitle);
      formData.set("senderCompany", form.senderCompany);
      formData.set("calendarLink", form.calendarLink);
      formData.set("companyDescription", form.companyDescription);
      formData.set("valueProposition", form.valueProposition);
      formData.set("socialProof", form.socialProof);
      await saveSenderProfileAction({}, formData);
      await completeOnboardingAction();
      setDismissed(true);
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && skip()}>
      <DialogContent className="w-full max-w-md">
        <DialogHeader>
          <p className="text-[11px] text-muted-foreground">Step {step} of 3</p>
          <DialogTitle>
            {step === 1 && "Set up your sender profile"}
            {step === 2 && "Describe your value proposition"}
            {step === 3 && "You're all set!"}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {step === 1 && "This info appears in your cold emails."}
            {step === 2 && "Used by AI to craft personalized emails."}
            {step === 3 && "Here's how to get started:"}
          </p>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-3">
            <div>
              <label className={labelClass} htmlFor="ob-name">
                Your name
              </label>
              <input id="ob-name" className={inputClass} value={form.senderName} onChange={(e) => set("senderName", e.target.value)} />
            </div>
            <div>
              <label className={labelClass} htmlFor="ob-title">
                Your title
              </label>
              <input
                id="ob-title"
                className={inputClass}
                placeholder="e.g. Business Development Manager"
                value={form.senderTitle}
                onChange={(e) => set("senderTitle", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="ob-company">
                Company
              </label>
              <input id="ob-company" className={inputClass} value={form.senderCompany} onChange={(e) => set("senderCompany", e.target.value)} />
            </div>
            <div>
              <label className={labelClass} htmlFor="ob-calendar">
                Calendar link (for meetings)
              </label>
              <input
                id="ob-calendar"
                className={inputClass}
                placeholder="https://cal.com/you"
                value={form.calendarLink}
                onChange={(e) => set("calendarLink", e.target.value)}
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <div>
              <label className={labelClass} htmlFor="ob-desc">
                What does your company do? (1-2 sentences)
              </label>
              <textarea
                id="ob-desc"
                rows={2}
                className={textareaClass}
                value={form.companyDescription}
                onChange={(e) => set("companyDescription", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="ob-value">
                Key value proposition
              </label>
              <textarea
                id="ob-value"
                rows={2}
                className={textareaClass}
                value={form.valueProposition}
                onChange={(e) => set("valueProposition", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="ob-proof">
                Social proof (optional)
              </label>
              <textarea
                id="ob-proof"
                rows={2}
                className={textareaClass}
                value={form.socialProof}
                onChange={(e) => set("socialProof", e.target.value)}
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3 text-sm text-foreground">
            <ol className="list-decimal space-y-1.5 pl-4">
              <li>Import leads from CSV or add manually</li>
              <li>Click &ldquo;Research&rdquo; on a lead to run AI analysis</li>
              <li>Generate a personalized cold email</li>
              <li>Prepare a call pitch and log outcomes</li>
              <li>Track conversions in the Admin Dashboard</li>
            </ol>
            <div className="rounded-md bg-muted/60 px-3 py-2.5 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Tip: </span>
              The AI learns from your email outcomes. Mark emails as &ldquo;Replied&rdquo; or &ldquo;No response&rdquo; to improve future generation.
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={skip}
            disabled={isPending}
            className="h-8 rounded-md border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-60"
          >
            Skip setup
          </button>
          <div className="flex items-center gap-2">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                disabled={isPending}
                className="h-8 rounded-md border border-border px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60"
              >
                Back
              </button>
            )}
            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                className="h-8 rounded-md px-4 text-xs font-medium text-white transition-opacity hover:opacity-90"
                style={{ background: "var(--primary)" }}
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={finish}
                disabled={isPending}
                className="h-8 rounded-md px-4 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ background: "var(--primary)" }}
              >
                {isPending ? "Saving…" : "Get started!"}
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
