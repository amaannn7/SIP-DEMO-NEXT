import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The standard panel wrapper for every dashboard section — one header
 * treatment (title, optional count pill, optional description, optional
 * action) shared across the app, so panels stop each rolling their own
 * heading markup and spacing.
 */
export function SectionCard({
  title,
  description,
  count,
  action,
  href,
  hrefLabel = "View all",
  className,
  bodyClassName,
  children,
}: {
  title: string;
  description?: string;
  /** Rendered as a pill next to the title. */
  count?: number;
  /** Custom action node, rendered right-aligned in the header. */
  action?: React.ReactNode;
  /** Convenience alternative to `action`: renders a "View all →" link. */
  href?: string;
  hrefLabel?: string;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("card-surface flex flex-col rounded-xl border border-border bg-card", className)}>
      <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-semibold tracking-tight text-foreground">{title}</h3>
            {count !== undefined && (
              <span className="tnum rounded-full bg-[color-mix(in_oklch,var(--primary)_12%,transparent)] px-2 py-0.5 text-[11px] font-semibold text-[var(--primary)]">
                {count}
              </span>
            )}
          </div>
          {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
        </div>

        {action ??
          (href && (
            <Link
              href={href}
              className="group flex shrink-0 items-center gap-1 text-xs font-medium text-[var(--primary)] transition-opacity hover:opacity-75"
            >
              {hrefLabel}
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
      </div>

      <div className={cn("flex-1 px-5 pb-5", bodyClassName)}>{children}</div>
    </section>
  );
}

/** Consistent empty state for section bodies — centered, quiet, never a bare sentence. */
export function SectionEmpty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-10 text-center">
      <p className="text-xs text-muted-foreground">{children}</p>
    </div>
  );
}
