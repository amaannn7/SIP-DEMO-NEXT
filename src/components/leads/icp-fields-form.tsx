"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { IcpFieldDef } from "@/lib/scoring/fit-score";
import { saveIcpAnswersAction, type SaveIcpAnswersState } from "@/app/(dashboard)/leads/[id]/icp-actions";

const initialState: SaveIcpAnswersState = {};

const inputClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-all focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10";
const labelClass = "mb-1 block text-xs font-medium text-muted-foreground";

export function IcpFieldsForm({
  leadId,
  fields,
  answers,
}: {
  leadId: string;
  fields: IcpFieldDef[];
  answers: Record<string, unknown>;
}) {
  const boundAction = saveIcpAnswersAction.bind(null, leadId);
  const [state, formAction] = useActionState(boundAction, initialState);

  if (fields.length === 0) return null;

  return (
    <div className="card-surface rounded-xl border border-border bg-card p-5">
      <h3 className="mb-1 text-[15px] font-semibold tracking-tight text-foreground">Qualification data</h3>
      <p className="mb-4 text-[11px] text-muted-foreground">Feeds the fit score, the org&rsquo;s configured ICP fields.</p>

      <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {fields.map((field) => (
          <div key={field.key} className={field.fieldType === "text" ? "sm:col-span-2" : undefined}>
            <label className={labelClass} htmlFor={`icp-${field.key}`}>
              {field.label}
              {field.isRequired && <span className="text-destructive"> *</span>}
            </label>
            {field.subtitle && <p className="-mt-0.5 mb-1 text-[11px] text-muted-foreground">{field.subtitle}</p>}
            {field.fieldType === "select" || field.fieldType === "multiselect" ? (
              <select
                id={`icp-${field.key}`}
                name={field.key}
                multiple={field.fieldType === "multiselect"}
                defaultValue={
                  field.fieldType === "multiselect"
                    ? (Array.isArray(answers[field.key]) ? (answers[field.key] as string[]) : [])
                    : (typeof answers[field.key] === "string" ? (answers[field.key] as string) : "")
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
                id={`icp-${field.key}`}
                name={field.key}
                defaultValue={answers[field.key] === true ? "true" : answers[field.key] === false ? "false" : ""}
                className={inputClass}
              >
                <option value="">Not set</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            ) : field.fieldType === "number" ? (
              <input
                id={`icp-${field.key}`}
                name={field.key}
                type="number"
                defaultValue={typeof answers[field.key] === "number" ? (answers[field.key] as number) : ""}
                className={inputClass}
              />
            ) : (
              <textarea
                id={`icp-${field.key}`}
                name={field.key}
                rows={2}
                defaultValue={typeof answers[field.key] === "string" ? (answers[field.key] as string) : ""}
                className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-all focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10"
              />
            )}
          </div>
        ))}

        <div className="sm:col-span-2 flex items-center gap-3">
          <SubmitButton />
          {state.error && <p className="text-xs text-destructive">{state.error}</p>}
          {state.success && <p className="text-xs text-success">Saved. Fit score recalculated.</p>}
        </div>
      </form>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-9 rounded-md px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      style={{ background: "var(--primary)" }}
    >
      {pending ? "Saving…" : "Save qualification data"}
    </button>
  );
}
