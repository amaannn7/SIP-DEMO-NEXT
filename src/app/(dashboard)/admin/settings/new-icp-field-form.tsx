"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Plus } from "lucide-react";
import { createIcpFieldAction, type CreateIcpFieldState } from "./icp-actions";

const initialState: CreateIcpFieldState = {};

const inputClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-all focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10";
const labelClass = "mb-1 block text-xs font-medium text-muted-foreground";

/** Ports the source system's add-req-form: lets an admin add a new qualification question beyond the built-in set. */
export function NewIcpFieldForm() {
  const [state, formAction] = useActionState(createIcpFieldAction, initialState);
  const [open, setOpen] = useState(false);
  const [fieldType, setFieldType] = useState("select");
  const formRef = useRef<HTMLFormElement>(null);
  const submittedRef = useRef(false);

  useEffect(() => {
    if (submittedRef.current && !state.error) {
      formRef.current?.reset();
      setOpen(false);
    }
    submittedRef.current = false;
  }, [state]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-8 items-center gap-1.5 rounded-md border border-dashed border-input px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Plus className="size-3.5" />
        Add question
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={() => {
        submittedRef.current = true;
      }}
      className="space-y-3 rounded-md border border-border bg-muted/30 p-3"
    >
      <div>
        <label className={labelClass} htmlFor="new-icp-label">
          Question
        </label>
        <input id="new-icp-label" name="label" required placeholder="e.g. Budget confirmed" className={inputClass} />
      </div>
      <div>
        <label className={labelClass} htmlFor="new-icp-subtitle">
          Prompt shown to reps (optional)
        </label>
        <input id="new-icp-subtitle" name="subtitle" placeholder="e.g. Has the prospect confirmed a budget range?" className={inputClass} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass} htmlFor="new-icp-type">
            Answer type
          </label>
          <select id="new-icp-type" name="fieldType" value={fieldType} onChange={(e) => setFieldType(e.target.value)} className={inputClass}>
            <option value="select">Single choice</option>
            <option value="multiselect">Multiple choice</option>
            <option value="text">Free text</option>
            <option value="number">Number</option>
            <option value="boolean">Yes / No</option>
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="new-icp-weight">
            Weight (points)
          </label>
          <input id="new-icp-weight" name="weight" type="number" min={0} max={100} defaultValue={10} className={inputClass} />
        </div>
      </div>
      {(fieldType === "select" || fieldType === "multiselect") && (
        <div>
          <label className={labelClass} htmlFor="new-icp-options">
            Options (one per line)
          </label>
          <textarea
            id="new-icp-options"
            name="options"
            rows={3}
            placeholder={"Yes, confirmed\nEstimated only\nNot discussed"}
            className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-all focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10"
          />
        </div>
      )}

      {state.error && <p className="text-xs text-destructive">{state.error}</p>}

      <div className="flex items-center gap-2">
        <SubmitButton />
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="h-8 rounded-md border border-border px-3 text-xs text-muted-foreground hover:bg-muted"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-8 rounded-md px-4 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      style={{ background: "var(--primary)" }}
    >
      {pending ? "Adding…" : "Add question"}
    </button>
  );
}
