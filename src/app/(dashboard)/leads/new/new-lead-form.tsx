"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { LeadFormFields } from "@/components/leads/lead-form-fields";
import { NewLeadSourceFields } from "@/components/leads/new-lead-source-fields";
import { createLeadAction, type LeadFormState } from "../actions";

const initialState: LeadFormState = {};

export function NewLeadForm() {
  const [state, formAction] = useActionState(createLeadAction, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <LeadFormFields />
      <div className="border-t border-border pt-5">
        <NewLeadSourceFields />
      </div>

      {state.error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-2">
        <SubmitButton />
        <Link
          href="/leads"
          className="flex h-9 items-center rounded-md border border-input px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          Cancel
        </Link>
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
      className="flex h-9 items-center rounded-md px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-70"
      style={{ background: "var(--primary)" }}
    >
      {pending ? "Saving…" : "Create lead"}
    </button>
  );
}
