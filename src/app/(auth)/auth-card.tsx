import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { BrandMark } from "@/components/shared/brand-mark";

/**
 * Shared shell for the secondary auth screens (forgot/reset password) —
 * mirrors login's centered, minimal layout: mark + heading outside the card,
 * a single soft gradient bloom behind everything, a thin gradient rule along
 * the card's top edge as the one "eye-catching" detail. No side art panel.
 */
export function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="app-shell-bg relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div
        className="brand-gradient-soft pointer-events-none absolute top-1/2 left-1/2 size-[40rem] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        aria-hidden
      />

      <div className="absolute top-6 right-6">
        <ThemeToggle />
      </div>

      <div className="relative w-full max-w-[400px]">
        <div className="flex flex-col items-center text-center">
          <div className="relative">
            <div className="brand-gradient-soft absolute inset-0 -z-10 scale-[2.2] rounded-full blur-xl" aria-hidden />
            <BrandMark size={44} />
          </div>
          <h1 className="mt-5 text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          {description && <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>}
        </div>

        <div className="card-surface relative mt-7 overflow-hidden rounded-2xl border border-border bg-card p-6 sm:p-8">
          <span className="brand-gradient absolute inset-x-0 top-0 h-[3px]" aria-hidden />
          {children}

          <Link
            href="/login"
            className="mt-6 flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
