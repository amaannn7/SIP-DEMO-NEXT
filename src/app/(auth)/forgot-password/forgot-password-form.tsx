"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Mail, Check } from "lucide-react";
import { requestPasswordResetAction, type RequestPasswordResetState } from "../actions";

const initialState: RequestPasswordResetState = {};

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(requestPasswordResetAction, initialState);

  if (state.message) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-2 rounded-md bg-success/10 px-3 py-2.5 text-xs text-success">
          <Check className="mt-0.5 size-3.5 shrink-0" />
          <span>{state.message}</span>
        </div>
        {/* No outbound email delivery in this template — show the link directly so it can be relayed manually or opened right here. */}
        {state.resetLink && (
          <div className="rounded-md border border-border bg-muted/40 px-3 py-2.5 text-xs">
            <p className="mb-1 text-muted-foreground">Reset link (dev mode, no email delivery configured):</p>
            <a href={state.resetLink} className="break-all text-[var(--accent)] hover:underline">
              {state.resetLink}
            </a>
          </div>
        )}
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <div className="relative">
        <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          id="email"
          name="email"
          type="email"
          placeholder="Email address"
          required
          autoFocus
          className="h-10 w-full rounded-md border border-input bg-background pr-3 pl-9 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--primary)]/8"
        />
      </div>

      {state.error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive" role="alert">
          {state.error}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-10 w-full items-center justify-center rounded-md text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-70"
      style={{ background: "var(--primary)" }}
    >
      {pending ? "Sending…" : "Send reset link"}
    </button>
  );
}
