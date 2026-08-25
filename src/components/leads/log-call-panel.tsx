"use client";

import { useActionState, useState } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { CALL_OUTCOME_OPTIONS, NEXT_ACTION_OPTIONS, type CallOutcome, type NextAction } from "@/lib/calls/outcomes";
import { logCallOutcomeAction, type LogCallState } from "@/app/(dashboard)/leads/[id]/call-log-actions";
import type { IcpFieldDef } from "@/lib/scoring/fit-score";

const initialState: LogCallState = {};

/**
 * A single numbered wizard — Outcome -> Qualification Data -> Notes -> Next
 * Action — saved atomically in one submit, matching the source system's
 * Outcome tab exactly (it was previously three disconnected cards with no
 * Next Action step at all). Each choice-driven step uses click-select option
 * cards rather than a plain <select>, mirroring the source system's
 * `.outcome-option` pattern — legibility matters more here than compactness,
 * since a rep is reading and picking from a list of full sentences.
 *
 * Renders directly rather than behind its own "Log a call" toggle — Outcome
 * already has its own workflow tab, so a second click to reveal the form
 * inside it was a redundant extra step.
 */
export function LogCallPanel({ leadId, icpFields, answers }: { leadId: string; icpFields: IcpFieldDef[]; answers: Record<string, unknown> }) {
  const action = logCallOutcomeAction.bind(null, leadId);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [outcome, setOutcome] = useState<CallOutcome | null>(null);
  const [nextAction, setNextAction] = useState<NextAction | null>(null);

  // Ports the source system's saveCallOutcome() exactly: each required step
  // is checked client-side, in order, with an early-return toast on the
  // first one that's missing — so an incomplete submit never round-trips to
  // the server at all. The old version left this entirely to server-side
  // Zod validation, which only ever surfaced errors for two of the four
  // required steps (qualification, follow-up date) — an unpicked Outcome or
  // Next Action failed with no visible indication of what was wrong.
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!outcome) {
      e.preventDefault();
      toast.warning("Select a call outcome");
      return;
    }
    if (icpFields.length > 0) {
      const formData = new FormData(e.currentTarget);
      const hasAnyAnswer = icpFields.some((field) => {
        if (field.fieldType === "multiselect") return formData.getAll(`icp.${field.key}`).length > 0;
        const value = formData.get(`icp.${field.key}`);
        return value !== null && value !== "";
      });
      if (!hasAnyAnswer) {
        e.preventDefault();
        toast.warning("Complete qualification data");
        return;
      }
    }
    if (!nextAction) {
      e.preventDefault();
      toast.warning("Select next action");
      return;
    }
    if (nextAction === "followup_date" && !(new FormData(e.currentTarget).get("followupDate"))) {
      e.preventDefault();
      toast.warning("Select a follow-up date");
      return;
    }
  }

  // Ports the source system's exact step numbering: Outcome is step 1, then
  // EACH enabled qualification/ICP field gets its own number (2, 3, 4...),
  // not one combined "step 2" for the whole qualification section — the
  // source system's reqOptions loop numbers every individual requisition
  // card, so a rep sees the true count of things left to fill in rather than
  // one step that quietly contains several fields. Notes and Next Action
  // then continue the count past however many fields exist.
  const notesStep = 2 + icpFields.length;
  const nextActionStep = notesStep + 1;

  return (
    <div className="card-surface rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-[15px] font-semibold tracking-tight text-foreground">Log call outcome</h3>
        {/* Top placement mirrors this app's own pattern elsewhere (a compact
            action duplicated right under the header, not just at the very
            bottom of a long form) — the wizard grows with however many
            qualification fields an org has configured, so a rep shouldn't
            have to scroll past all of them to save once everything's filled in. */}
        <SubmitButton form="log-call-outcome-form" isPending={isPending} />
      </div>
      <form id="log-call-outcome-form" action={formAction} onSubmit={handleSubmit} className="space-y-6">
        <WizardStep number={1} title="Outcome" required>
          <div className="flex flex-wrap gap-1.5">
            {CALL_OUTCOME_OPTIONS.map((opt) => (
              <OptionPill key={opt.value} label={opt.label} selected={outcome === opt.value} onSelect={() => setOutcome(opt.value)} />
            ))}
          </div>
          {/* Real radios (visually hidden) so the native form submits `outcome`
              without extra client-side wiring — the pills above just drive them.
              Not marked `required`: validation is handled by handleSubmit's
              toast-and-early-return so every missing-step message is
              consistent, instead of some steps failing via native HTML
              validation (a silent focus-jump) and others via toast. */}
          <div className="sr-only">
            {CALL_OUTCOME_OPTIONS.map((opt) => (
              <input key={opt.value} type="radio" name="outcome" value={opt.value} checked={outcome === opt.value} onChange={() => setOutcome(opt.value)} />
            ))}
          </div>
        </WizardStep>

        {icpFields.map((field, i) => (
          <WizardStep key={field.key} number={2 + i} title={field.label} required={i === 0} subtitle={i === 0 ? "At least one field is required." : undefined}>
            <IcpFieldControl field={field} defaultValue={answers[field.key]} />
          </WizardStep>
        ))}

        <WizardStep number={notesStep} title="Notes" subtitle="Optional">
          <textarea
            name="notes"
            rows={2}
            maxLength={500}
            placeholder="Anything worth remembering from this call…"
            className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10"
          />
        </WizardStep>

        <WizardStep number={nextActionStep} title="Next Action" required>
          <div className="flex flex-wrap gap-1.5">
            {NEXT_ACTION_OPTIONS.map((opt) => (
              <OptionPill key={opt.value} label={opt.label} selected={nextAction === opt.value} onSelect={() => setNextAction(opt.value)} />
            ))}
          </div>
          <div className="sr-only">
            {NEXT_ACTION_OPTIONS.map((opt) => (
              <input key={opt.value} type="radio" name="nextAction" value={opt.value} checked={nextAction === opt.value} onChange={() => setNextAction(opt.value)} />
            ))}
          </div>

          {/* Only revealed (and only required) when Next Action is "Schedule
              Follow-up" — matches the source system's conditional date picker
              exactly. */}
          {nextAction === "followup_date" && (
            <div className="mt-3">
              <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="call-log-followupDate">
                Follow-up date
              </label>
              <input
                id="call-log-followupDate"
                name="followupDate"
                type="date"
                className="h-9 w-full max-w-56 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus:border-[var(--primary)]"
              />
            </div>
          )}
        </WizardStep>

        {state.error && <p className="text-xs text-destructive">{state.error}</p>}
      </form>
    </div>
  );
}

function WizardStep({
  number,
  title,
  subtitle,
  required,
  children,
}: {
  number: number;
  title: string;
  subtitle?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2.5 flex items-baseline gap-2">
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
          {number}
        </span>
        <h4 className="text-[13px] font-semibold text-foreground">
          {title}
          {required && <span className="ml-1 font-normal text-muted-foreground">(Required)</span>}
        </h4>
        {subtitle && !required && <span className="text-[11px] text-muted-foreground">{subtitle}</span>}
      </div>
      {subtitle && required && <p className="mb-2 ml-7 text-[11px] text-muted-foreground">{subtitle}</p>}
      <div className="ml-7">{children}</div>
    </div>
  );
}

function OptionPill({ label, selected, onSelect }: { label: string; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-left text-[12px] font-medium transition-colors",
        selected
          ? "border-[var(--primary)] bg-[color-mix(in_oklch,var(--primary)_10%,transparent)] text-[var(--primary)]"
          : "border-border text-foreground hover:bg-muted",
      )}
    >
      {selected && <Check className="size-3" strokeWidth={3} />}
      {label}
    </button>
  );
}

/** Same per-type control shapes as the standalone ICP form, namespaced under `icp.{key}` so they submit alongside outcome/nextAction in one request. */
function IcpFieldControl({ field, defaultValue }: { field: IcpFieldDef; defaultValue: unknown }) {
  const inputClass =
    "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-all focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10";
  const name = `icp.${field.key}`;

  return (
    <div className={field.fieldType === "text" ? "sm:col-span-2" : undefined}>
      <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor={`call-icp-${field.key}`}>
        {field.label}
      </label>
      {field.subtitle && <p className="-mt-0.5 mb-1 text-[11px] text-muted-foreground">{field.subtitle}</p>}
      {field.fieldType === "select" || field.fieldType === "multiselect" ? (
        <select
          id={`call-icp-${field.key}`}
          name={name}
          multiple={field.fieldType === "multiselect"}
          defaultValue={
            field.fieldType === "multiselect"
              ? Array.isArray(defaultValue)
                ? (defaultValue as string[])
                : []
              : typeof defaultValue === "string"
                ? defaultValue
                : ""
          }
          className={inputClass}
        >
          {field.fieldType === "select" && <option value="">Not set</option>}
          {(field.options ?? []).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : field.fieldType === "boolean" ? (
        <select
          id={`call-icp-${field.key}`}
          name={name}
          defaultValue={defaultValue === true ? "true" : defaultValue === false ? "false" : ""}
          className={inputClass}
        >
          <option value="">Not set</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      ) : field.fieldType === "number" ? (
        <input
          id={`call-icp-${field.key}`}
          name={name}
          type="number"
          defaultValue={typeof defaultValue === "number" ? defaultValue : ""}
          className={inputClass}
        />
      ) : (
        <textarea
          id={`call-icp-${field.key}`}
          name={name}
          rows={2}
          defaultValue={typeof defaultValue === "string" ? defaultValue : ""}
          className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-all focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10"
        />
      )}
    </div>
  );
}

/** `form` attribute lets this render outside the <form> (in the header) while still submitting it and firing its onSubmit validation — standard HTML association, not a React trick. Pending state is passed in from useActionState's own tuple since useFormStatus only works for a button rendered as a form descendant. */
function SubmitButton({ form, isPending }: { form: string; isPending: boolean }) {
  return (
    <button
      type="submit"
      form={form}
      disabled={isPending}
      className="flex h-8 items-center gap-1.5 rounded-lg px-3.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      style={{ background: "var(--primary)" }}
    >
      {isPending ? "Saving…" : "Save outcome"}
    </button>
  );
}
