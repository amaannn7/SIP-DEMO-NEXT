"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { loginAction, type LoginState } from "../actions";

const initialState: LoginState = {};

// Auth screens get more air than in-app forms: 44px fields, real labels above
// the input rather than placeholder-only, and a 44px submit.
const FIELD_CLASSES =
  "h-11 w-full rounded-xl border border-input bg-card text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--primary)]/12";

export function LoginForm() {
  const [state, formAction] = useActionState(loginAction, initialState);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-1.5">
        <label htmlFor="email" className="text-[13px] font-medium text-foreground">
          Email address
        </label>
        <div className="relative">
          <Mail className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="email"
            name="email"
            type="email"
            placeholder="you@company.com"
            required
            autoFocus
            autoComplete="email"
            className={cn(FIELD_CLASSES, "pr-3.5 pl-10")}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="text-[13px] font-medium text-foreground">
          Password
        </label>
        <div className="relative">
          <Lock className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            required
            autoComplete="current-password"
            className={cn(FIELD_CLASSES, "pr-10 pl-10")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute top-1/2 right-3.5 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
            aria-label={showPassword ? "Hide password" : "Show password"}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>

      {state.error && (
        <p
          className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive"
          role="alert"
        >
          <AlertCircle className="mt-px size-3.5 shrink-0" />
          {state.error}
        </p>
      )}

      <SubmitButton />

      <p className="text-center text-xs text-muted-foreground">
        Trouble signing in? Contact your administrator.
      </p>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    // The gradient button — this screen's single most important action, which
    // is exactly what the `brand` treatment is reserved for (DESIGN.md §5).
    <button
      type="submit"
      disabled={pending}
      className="brand-gradient group flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white shadow-[0_4px_16px_-4px_color-mix(in_oklch,var(--primary)_50%,transparent)] transition-all hover:brightness-[1.07] hover:shadow-[0_6px_20px_-4px_color-mix(in_oklch,var(--primary)_60%,transparent)] disabled:opacity-70"
    >
      {pending ? "Signing in…" : "Sign in"}
      {!pending && <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />}
    </button>
  );
}
