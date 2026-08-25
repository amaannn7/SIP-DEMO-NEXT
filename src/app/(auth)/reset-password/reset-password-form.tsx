"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Lock, Eye, EyeOff, Check } from "lucide-react";
import { resetPasswordAction, type ResetPasswordState } from "../actions";

const initialState: ResetPasswordState = {};

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction] = useActionState(resetPasswordAction, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  if (state.success) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-2 rounded-md bg-success/10 px-3 py-2.5 text-xs text-success">
          <Check className="mt-0.5 size-3.5 shrink-0" />
          <span>Password reset. Sign in with your new password.</span>
        </div>
        <button
          type="button"
          onClick={() => router.push("/login")}
          className="flex h-10 w-full items-center justify-center rounded-md text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ background: "var(--primary)" }}
        >
          Go to sign in
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      <div className="relative">
        <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          id="password"
          name="password"
          type={showPassword ? "text" : "password"}
          placeholder="New password"
          required
          autoFocus
          className="h-10 w-full rounded-md border border-input bg-background pr-9 pl-9 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--primary)]/8"
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
          aria-label={showPassword ? "Hide password" : "Show password"}
          tabIndex={-1}
        >
          {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
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
      {pending ? "Resetting…" : "Reset password"}
    </button>
  );
}
