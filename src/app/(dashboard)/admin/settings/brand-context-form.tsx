"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { AiBrandContext } from "@/lib/db/schema";
import { updateBrandContextAction } from "./ai-actions";

export function BrandContextForm({ brandContext }: { brandContext: AiBrandContext }) {
  const [state, formAction] = useActionState(updateBrandContextAction, {});

  return (
    <form action={formAction} className="space-y-4">
      <Field
        name="companyDescription"
        label="Company description"
        placeholder="A brief description of the company and what it does"
        defaultValue={brandContext.companyDescription}
      />
      <Field
        name="valueProposition"
        label="Value proposition"
        placeholder="What problem this company solves for customers"
        defaultValue={brandContext.valueProposition}
      />
      <Field
        name="socialProof"
        label="Social proof"
        placeholder="Notable customers, results, or credibility markers (optional)"
        defaultValue={brandContext.socialProof}
      />
      <Field
        name="toneGuidelines"
        label="Tone guidelines"
        placeholder="e.g. Direct, practical, no exclamation marks"
        defaultValue={brandContext.toneGuidelines}
        rows={2}
      />
      <div className="flex items-center gap-3">
        <SubmitButton />
        {state.error && <p className="text-xs text-destructive">{state.error}</p>}
      </div>
    </form>
  );
}

function Field({
  name,
  label,
  placeholder,
  defaultValue,
  rows = 3,
}: {
  name: string;
  label: string;
  placeholder: string;
  defaultValue?: string;
  rows?: number;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor={name}>
        {label}
      </label>
      <textarea
        id={name}
        name={name}
        rows={rows}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
      />
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-8 rounded-md px-3 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      style={{ background: "var(--primary)" }}
    >
      {pending ? "Saving…" : "Save brand context"}
    </button>
  );
}
