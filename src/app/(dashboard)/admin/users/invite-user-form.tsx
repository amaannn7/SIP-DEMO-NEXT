"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { UserPlus } from "lucide-react";
import { inviteUserAction, type InviteUserState } from "./actions";

const initialState: InviteUserState = {};

export function InviteUserForm({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [state, formAction] = useActionState(inviteUserAction, initialState);
  const [open, setOpen] = useState(false);
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
        className="flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium text-white transition-opacity hover:opacity-90"
        style={{ background: "var(--primary)" }}
      >
        <UserPlus className="size-3.5" />
        Add user
      </button>
    );
  }

  return (
    <div className="card-surface rounded-xl border border-border bg-card p-4">
      <h3 className="mb-3 text-[15px] font-semibold tracking-tight text-foreground">Add a team member</h3>
      <form
        ref={formRef}
        action={formAction}
        onSubmit={() => {
          submittedRef.current = true;
        }}
        className="flex flex-wrap items-end gap-3"
      >
        <Field name="displayName" label="Name" type="text" />
        <Field name="email" label="Email" type="email" />
        <Field name="password" label="Temporary password" type="text" />
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="role">
            Role
          </label>
          <select
            id="role"
            name="role"
            defaultValue="rep"
            className="h-9 rounded-md border border-input bg-background px-2 text-sm outline-none focus:border-[var(--primary)]"
          >
            <option value="rep">Rep</option>
            <option value="admin">Admin</option>
            {isSuperAdmin && <option value="super_admin">Super admin</option>}
          </select>
        </div>
        <SubmitButton />
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="h-9 rounded-md border border-border px-3 text-xs text-muted-foreground hover:bg-muted"
        >
          Cancel
        </button>
        {state.error && <p className="w-full text-xs text-destructive">{state.error}</p>}
      </form>
    </div>
  );
}

function Field({ name, label, type }: { name: string; label: string; type: string }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required
        className="h-9 rounded-md border border-input bg-background px-2 text-sm outline-none focus:border-[var(--primary)]"
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
      className="h-9 rounded-md px-3 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      style={{ background: "var(--primary)" }}
    >
      {pending ? "Adding…" : "Add user"}
    </button>
  );
}
