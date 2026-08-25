"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { FitGradeThresholds } from "@/lib/scoring/fit-score";
import { updateThresholdsAction } from "./icp-actions";

export function ThresholdsForm({ thresholds }: { thresholds: FitGradeThresholds }) {
  const [state, formAction] = useActionState(updateThresholdsAction, {});

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-4">
      <ThresholdInput name="gradeAThreshold" label="Grade A ≥" defaultValue={thresholds.gradeAThreshold} />
      <ThresholdInput name="gradeBThreshold" label="Grade B ≥" defaultValue={thresholds.gradeBThreshold} />
      <ThresholdInput name="gradeCThreshold" label="Grade C ≥" defaultValue={thresholds.gradeCThreshold} />
      <SubmitButton />
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
    </form>
  );
}

function ThresholdInput({ name, label, defaultValue }: { name: string; label: string; defaultValue: number }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="number"
        min={0}
        max={100}
        defaultValue={defaultValue}
        className="h-8 w-20 rounded-md border border-input bg-background px-2 text-sm outline-none focus:border-[var(--primary)]"
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
      {pending ? "Saving…" : "Save thresholds"}
    </button>
  );
}
