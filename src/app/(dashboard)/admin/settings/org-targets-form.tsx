"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { saveOrgDefaultTargetsAction, type SaveOrgTargetsState } from "./daily-targets-actions";

const initialState: SaveOrgTargetsState = {};

export function OrgTargetsForm({ targets }: { targets: { callsTarget: number; emailsTarget: number; researchTarget: number } }) {
  const [state, formAction] = useActionState(saveOrgDefaultTargetsAction, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-4">
      <NumberField name="callsTarget" label="Calls" defaultValue={targets.callsTarget} />
      <NumberField name="emailsTarget" label="Emails" defaultValue={targets.emailsTarget} />
      <NumberField name="researchTarget" label="Research" defaultValue={targets.researchTarget} />
      <SubmitButton />
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
    </form>
  );
}

function NumberField({ name, label, defaultValue }: { name: string; label: string; defaultValue: number }) {
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
        max={500}
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
      {pending ? "Saving…" : "Save org defaults"}
    </button>
  );
}
