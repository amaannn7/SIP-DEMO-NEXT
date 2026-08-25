"use client";

import { useState, useTransition } from "react";
import { UserCog, KeyRound, Copy, Check, Trash2, Phone } from "lucide-react";
import type { users as usersTable } from "@/lib/db/schema";
import {
  updateUserRoleAction,
  setUserActiveAction,
  resetUserPasswordAction,
  resetUserLeadsAction,
  updateUserAircallSettingsAction,
} from "./actions";
import { impersonateUserAction } from "@/app/(dashboard)/actions";

type UserRow = typeof usersTable.$inferSelect;

const ROLE_LABELS: Record<UserRow["role"], string> = {
  rep: "Rep",
  admin: "Admin",
  super_admin: "Super admin",
};

export function UserRow({
  user,
  isSelf,
  canManage,
  isSuperAdmin,
  canImpersonate,
}: {
  user: UserRow;
  isSelf: boolean;
  /** Admin-level: edit role (except granting super_admin), reset password, deactivate. */
  canManage: boolean;
  /** Super-admin-level: grant the super_admin role, reset a rep's lead data. */
  isSuperAdmin: boolean;
  canImpersonate: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [resetLeadsMessage, setResetLeadsMessage] = useState<string | null>(null);
  const [showAircall, setShowAircall] = useState(false);

  function handleReset() {
    if (!confirm(`Reset ${user.displayName}'s password? They'll be signed out everywhere and need the new password to log back in.`)) return;
    setError(null);
    startTransition(async () => {
      const result = await resetUserPasswordAction(user.id);
      if (result.error) setError(result.error);
      else if (result.newPassword) setNewPassword(result.newPassword);
    });
  }

  function handleResetLeads() {
    if (!confirm(`Move ALL of ${user.displayName}'s leads to trash? This clears their whole pipeline, meant for resetting demo/test data between pitches, not everyday use.`)) return;
    if (!confirm("This cannot be undone from here. Are you sure?")) return;
    setError(null);
    startTransition(async () => {
      const result = await resetUserLeadsAction(user.id);
      if (result.error) setError(result.error);
      else setResetLeadsMessage(`Moved ${result.deletedCount ?? 0} lead(s) to trash.`);
    });
  }

  return (
    <div className="px-3 py-2.5">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {user.displayName}
            {isSelf && <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">(you)</span>}
          </p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>

        {!user.isActive && (
          <span className="rounded bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">Inactive</span>
        )}

        {canManage && !isSelf ? (
          <form action={updateUserRoleAction.bind(null, user.id)}>
            <select
              name="role"
              defaultValue={user.role}
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs outline-none focus:border-[var(--primary)]"
            >
              <option value="rep">Rep</option>
              <option value="admin">Admin</option>
              {isSuperAdmin && <option value="super_admin">Super admin</option>}
            </select>
          </form>
        ) : (
          <span className="rounded bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {ROLE_LABELS[user.role]}
          </span>
        )}

        {!isSelf && (
          <div className="flex items-center gap-1.5">
            {canImpersonate && user.isActive && (
              <form action={impersonateUserAction.bind(null, user.id)}>
                <button
                  type="submit"
                  className="flex h-8 items-center gap-1 rounded-md border border-border px-2 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
                  title="View as this user"
                >
                  <UserCog className="size-3.5" />
                  Impersonate
                </button>
              </form>
            )}
            {canManage && (
              <button
                type="button"
                onClick={handleReset}
                disabled={isPending}
                className="flex h-8 items-center gap-1 rounded-md border border-border px-2 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-60"
                title="Reset password"
              >
                <KeyRound className="size-3.5" />
                Reset password
              </button>
            )}
            {isSuperAdmin && (
              <button
                type="button"
                onClick={handleResetLeads}
                disabled={isPending}
                className="flex h-8 items-center gap-1 rounded-md border border-border px-2 text-[11px] text-muted-foreground hover:bg-muted hover:text-destructive disabled:opacity-60"
                title="Reset lead data (demo/test cleanup)"
              >
                <Trash2 className="size-3.5" />
                Reset leads
              </button>
            )}
            {canManage && (
              <button
                type="button"
                onClick={() => setShowAircall((v) => !v)}
                className={`flex h-8 items-center gap-1 rounded-md border px-2 text-[11px] ${
                  user.aircallUserId ? "border-[var(--primary)]/40 text-[var(--primary)]" : "border-border text-muted-foreground"
                } hover:bg-muted`}
                title="Link Aircall account"
              >
                <Phone className="size-3.5" />
                Aircall
              </button>
            )}
            {canManage && (
              <form action={setUserActiveAction.bind(null, user.id, !user.isActive)}>
                <button
                  type="submit"
                  className="h-8 rounded-md border border-border px-2 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {user.isActive ? "Deactivate" : "Reactivate"}
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      {showAircall && (
        <form
          action={updateUserAircallSettingsAction.bind(null, user.id)}
          className="mt-2 flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2"
        >
          <div className="flex-1">
            <label className="mb-0.5 block text-[10px] text-muted-foreground">Aircall user ID</label>
            <input
              type="text"
              name="aircallUserId"
              defaultValue={user.aircallUserId ?? ""}
              placeholder="Found in the Aircall dashboard URL"
              className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs outline-none focus:border-[var(--primary)]"
            />
          </div>
          <div className="flex-1">
            <label className="mb-0.5 block text-[10px] text-muted-foreground">Aircall number ID</label>
            <input
              type="text"
              name="aircallNumberId"
              defaultValue={user.aircallNumberId ?? ""}
              placeholder="Found in the Aircall dashboard URL"
              className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs outline-none focus:border-[var(--primary)]"
            />
          </div>
          <button
            type="submit"
            className="h-7 shrink-0 rounded-md px-3 text-[11px] font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--primary)" }}
          >
            Save
          </button>
        </form>
      )}

      {error && <p className="mt-2 text-[11px] text-destructive">{error}</p>}

      {newPassword && (
        <div className="mt-2 flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2">
          <p className="flex-1 text-[11px] text-foreground">
            New password (shown once, {user.displayName} has been signed out everywhere):{" "}
            <span className="font-mono font-semibold">{newPassword}</span>
          </p>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(newPassword);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2 text-[11px] text-foreground hover:bg-muted"
          >
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            onClick={() => setNewPassword(null)}
            className="h-7 rounded-md px-2 text-[11px] text-muted-foreground hover:text-foreground"
          >
            Dismiss
          </button>
        </div>
      )}

      {resetLeadsMessage && (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-md border border-border bg-muted/60 px-3 py-2">
          <p className="text-[11px] text-foreground">{resetLeadsMessage}</p>
          <button
            type="button"
            onClick={() => setResetLeadsMessage(null)}
            className="h-7 rounded-md px-2 text-[11px] text-muted-foreground hover:text-foreground"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
