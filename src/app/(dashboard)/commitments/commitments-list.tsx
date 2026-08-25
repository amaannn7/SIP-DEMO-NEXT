"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Trash2, Phone, Mail, Search, ListTodo, ChevronDown } from "lucide-react";
import Link from "next/link";
import { addCommitmentAction, toggleCommitmentAction, deleteCommitmentAction, type AddCommitmentState } from "./actions";
import type { dailyCommitments, leads } from "@/lib/db/schema";

type CommitmentRow = typeof dailyCommitments.$inferSelect & {
  lead: Pick<typeof leads.$inferSelect, "id" | "firstName" | "lastName" | "company"> | null;
};

const initialState: AddCommitmentState = {};

const ACTION_ICONS: Record<CommitmentRow["action"], typeof Phone> = {
  call: Phone,
  email: Mail,
  research: Search,
  other: ListTodo,
};

export function CommitmentsList({ today, carriedOver }: { today: CommitmentRow[]; carriedOver: CommitmentRow[] }) {
  return (
    <div className="card-surface rounded-xl border border-border bg-card p-5">
      <h3 className="mb-1 text-[15px] font-semibold tracking-tight text-foreground">Today&rsquo;s commitments</h3>
      <p className="mb-3 text-[11px] text-muted-foreground">Ad-hoc tasks for today, separate from your numeric targets.</p>

      {carriedOver.length > 0 && (
        <div className="mb-4">
          <h4 className="mb-1.5 text-[11px] font-semibold tracking-wide text-warning-foreground uppercase">
            Carried over from earlier
          </h4>
          <div className="space-y-1.5">
            {carriedOver.map((item) => (
              <CommitmentRow key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        {today.length === 0 && carriedOver.length === 0 && (
          <p className="py-4 text-center text-xs text-muted-foreground">No commitments yet. Add one below.</p>
        )}
        {today.map((item) => (
          <CommitmentRow key={item.id} item={item} />
        ))}
      </div>

      <AddCommitmentForm />
    </div>
  );
}

function CommitmentRow({ item }: { item: CommitmentRow }) {
  const ActionIcon = ACTION_ICONS[item.action];
  return (
    <div className="flex items-center gap-2 rounded-md border border-border px-2.5 py-2">
      <form action={toggleCommitmentAction.bind(null, item.id, !item.isCompleted)}>
        <button
          type="submit"
          className={`flex size-5 shrink-0 items-center justify-center rounded border transition-colors ${
            item.isCompleted ? "border-success bg-success text-white" : "border-border hover:border-foreground"
          }`}
          aria-label={item.isCompleted ? "Mark incomplete" : "Mark complete"}
        >
          {item.isCompleted && <Check className="size-3" strokeWidth={3} />}
        </button>
      </form>

      <ActionIcon className="size-3.5 shrink-0 text-muted-foreground" />

      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm ${item.isCompleted ? "text-muted-foreground line-through" : "text-foreground"}`}>
          {item.description}
        </p>
        <div className="flex items-center gap-2">
          {item.dueTime && <span className="text-[11px] text-muted-foreground">{item.dueTime}</span>}
          {item.lead && (
            <Link href={`/leads/${item.lead.id}`} className="text-[11px] text-muted-foreground hover:underline">
              {[item.lead.firstName, item.lead.lastName].filter(Boolean).join(" ") || item.lead.company}
            </Link>
          )}
        </div>
      </div>

      <form action={deleteCommitmentAction.bind(null, item.id)}>
        <button
          type="submit"
          className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-destructive"
          aria-label="Delete commitment"
        >
          <Trash2 className="size-3.5" />
        </button>
      </form>
    </div>
  );
}

function AddCommitmentForm() {
  const [state, formAction] = useActionState(addCommitmentAction, initialState);
  const [showDetails, setShowDetails] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const submittedRef = useRef(false);

  useEffect(() => {
    if (submittedRef.current && !state.error) {
      formRef.current?.reset();
      setShowDetails(false);
    }
    submittedRef.current = false;
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={() => {
        submittedRef.current = true;
      }}
      className="mt-3 space-y-2 border-t border-border pt-3"
    >
      <div className="flex items-center gap-2">
        <input
          name="description"
          type="text"
          placeholder="Add a task for today…"
          required
          maxLength={300}
          className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-sm outline-none focus:border-[var(--primary)]"
        />
        <button
          type="button"
          onClick={() => setShowDetails((v) => !v)}
          className="flex h-8 items-center gap-1 rounded-md border border-border px-2 text-xs text-muted-foreground hover:bg-muted"
        >
          Details
          <ChevronDown className={`size-3 transition-transform ${showDetails ? "rotate-180" : ""}`} />
        </button>
        <SubmitButton />
      </div>

      {showDetails && (
        <div className="flex flex-wrap items-center gap-2">
          <select
            name="action"
            defaultValue="other"
            className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground outline-none focus:border-[var(--primary)]"
          >
            <option value="call">Call</option>
            <option value="email">Email</option>
            <option value="research">Research</option>
            <option value="other">Other</option>
          </select>
          <input
            name="dueTime"
            type="text"
            placeholder="Due time, e.g. 10:00"
            maxLength={20}
            className="h-8 w-36 rounded-md border border-input bg-background px-2 text-xs outline-none focus:border-[var(--primary)]"
          />
          <input
            name="leadId"
            type="text"
            placeholder="Linked lead ID (optional)"
            className="h-8 w-56 rounded-md border border-input bg-background px-2 text-xs outline-none focus:border-[var(--primary)]"
          />
        </div>
      )}

      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-8 shrink-0 rounded-md px-3 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      style={{ background: "var(--primary)" }}
    >
      Add
    </button>
  );
}
