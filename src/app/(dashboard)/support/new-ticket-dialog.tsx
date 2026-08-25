"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createTicketAction, type CreateTicketState } from "./actions";

const SUPPORT_CATEGORIES = [
  { value: "bug", label: "Something's broken" },
  { value: "how_to", label: "How do I..." },
  { value: "account", label: "Account / access" },
  { value: "performance", label: "Slow / performance" },
  { value: "other", label: "Other" },
];

const FEEDBACK_CATEGORIES = [
  { value: "feature", label: "Feature request" },
  { value: "improvement", label: "Improvement idea" },
  { value: "complaint", label: "Complaint" },
  { value: "praise", label: "Praise" },
  { value: "other", label: "Other" },
];

const fieldClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10";
const labelClass = "mb-1 block text-xs font-medium text-muted-foreground";

const initialState: CreateTicketState = {};

export function NewTicketDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (ticketId: string) => void;
}) {
  const [state, formAction] = useActionState(createTicketAction, initialState);
  const [type, setType] = useState<"support" | "feedback">("support");
  const formRef = useRef<HTMLFormElement>(null);
  const submittedRef = useRef(false);
  const categories = type === "support" ? SUPPORT_CATEGORIES : FEEDBACK_CATEGORIES;

  useEffect(() => {
    if (submittedRef.current && !state.error && state.ticketId) {
      formRef.current?.reset();
      setType("support");
      onOpenChange(false);
      onCreated(state.ticketId);
    }
    submittedRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to action state changing
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">New ticket</DialogTitle>
        </DialogHeader>

        <form ref={formRef} action={formAction} onSubmit={() => (submittedRef.current = true)} className="space-y-3">
          <div>
            <p className={labelClass}>Type</p>
            <div className="flex gap-1.5">
              {(["support", "feedback"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`h-7 rounded-md border px-3 text-xs font-medium capitalize transition-colors ${
                    type === t
                      ? "border-[var(--primary)] bg-[color-mix(in_oklch,var(--primary)_10%,transparent)] text-[var(--primary)]"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <input type="hidden" name="type" value={type} />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass} htmlFor="category">
                Category
              </label>
              <select id="category" name="category" defaultValue={categories[0].value} className={fieldClass}>
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="priority">
                Priority
              </label>
              <select id="priority" name="priority" defaultValue="normal" className={fieldClass}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor="subject">
              Subject
            </label>
            <input id="subject" name="subject" required maxLength={200} placeholder="Short summary" className={fieldClass} />
          </div>

          <div>
            <label className={labelClass} htmlFor="message">
              Message
            </label>
            <textarea
              id="message"
              name="message"
              required
              maxLength={5000}
              rows={4}
              placeholder="What's going on?"
              className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10"
            />
          </div>

          {state.error && <p className="text-xs text-destructive">{state.error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="h-8 rounded-md border border-border px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              Cancel
            </button>
            <SubmitButton />
          </div>
        </form>
      </DialogContent>
    </Dialog>
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
      {pending ? "Submitting…" : "Submit ticket"}
    </button>
  );
}
