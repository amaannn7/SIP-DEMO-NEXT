import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { NotificationBell } from "./notification-bell";
import { TopbarSearch } from "./topbar-search";
import { ThemeToggle } from "./theme-toggle";

export function Topbar({
  title,
  subtitle,
  titleAccessory,
  actions,
  backHref,
  backLabel,
}: {
  title: string;
  subtitle?: string;
  /** Rendered next to the title — e.g. the streak badge on Admin Dashboard/Commitments, matching the source system's page-title-row placement. */
  titleAccessory?: React.ReactNode;
  /** Page-level actions (date range, Export, primary CTA) sitting left of the global controls, as in the reference dashboard header. */
  actions?: React.ReactNode;
  /**
   * Renders an explicit "← Back to X" link above the title, for pages reached
   * by drilling into a list (lead detail, etc.) rather than via the sidebar —
   * an always-visible way back that doesn't rely on the browser's back button.
   */
  backHref?: string;
  backLabel?: string;
}) {
  return (
    // Translucent + blurred so content scrolls under it rather than colliding
    // with a hard opaque bar — the reference's header treatment.
    <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-border bg-background/80 px-6 py-3 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <div className="flex min-w-0 items-center gap-3">
        <div className="min-w-0">
          {backHref && (
            <Link
              href={backHref}
              className="mb-0.5 flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-[var(--primary)]"
            >
              <ArrowLeft className="size-3.5" />
              {backLabel ?? "Back"}
            </Link>
          )}
          <h1 className="truncate text-xl font-bold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {titleAccessory}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {actions}
        <TopbarSearch />
        <ThemeToggle />
        <NotificationBell />
      </div>
    </header>
  );
}
