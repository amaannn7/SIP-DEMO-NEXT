"use client";

import { LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { SidebarNav } from "./sidebar-nav";
import { SupportNavLink } from "./support-nav-link";
import { ImpersonationBanner } from "./impersonation-banner";
import { useSidebarCollapse } from "./sidebar-collapse-context";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BrandMark, BrandWordmark } from "@/components/shared/brand-mark";
import { logoutAction } from "@/app/(auth)/actions";
import { cn } from "@/lib/utils";
import type { Session } from "@/lib/auth/session";
import type { ResolvedBranding } from "@/lib/config/branding";

export function Sidebar({
  session,
  branding,
}: {
  session: Session;
  branding: ResolvedBranding;
}) {
  const { collapsed, toggle, ready } = useSidebarCollapse();
  const initials = session.user.displayName
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <aside
      className={cn(
        "group/sidebar fixed inset-y-0 left-0 z-30 flex w-(--sidebar-w) flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar)] py-3",
        // Only animate once the stored width has been applied, so a
        // restored-collapsed sidebar doesn't animate shut on load.
        ready && "transition-[width] duration-200 ease-out",
      )}
    >
      {/*
       * One toggle, one position: pinned to the sidebar's right edge, vertically
       * aligned with the logo row. Previously it lived inside the header's flex
       * row and the header switched to `flex-col` when collapsed, so the button
       * jumped below the logo — the control moved as you used it. Anchoring it
       * absolutely to the rail keeps it exactly where the user last clicked.
       * Icon swaps (rather than one glyph rotating) so it reads immediately as
       * "collapse panel" / "expand panel" instead of a generic directional arrow.
       */}
      <button
        type="button"
        onClick={toggle}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-expanded={!collapsed}
        className="absolute top-5 -right-3 z-40 flex size-6 items-center justify-center rounded-full border border-[var(--sidebar-border)] bg-[var(--sidebar)] text-muted-foreground shadow-sm transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50 focus-visible:outline-none"
      >
        {collapsed ? (
          <PanelLeftOpen className="size-3.5" strokeWidth={2} />
        ) : (
          <PanelLeftClose className="size-3.5" strokeWidth={2} />
        )}
      </button>

      {/* Header keeps its row direction in both states. Expanded, the full
          Levata wordmark image replaces the old icon+text-name pairing so the
          real logo (not a generic mark + org name) is what reads as the brand,
          sized large enough (38px) that its baked-in "Levata" text is actually
          legible. Collapsed, there's no room for the wide lockup, so it falls
          back to the square mark alone — 28px, close to the nav icons' 36px
          pill footprint but a touch smaller so it doesn't compete with the
          active-state pill directly below it (40px read as oversized). */}
      <div className={cn("flex h-12 items-center px-4", collapsed && "justify-center px-0")}>
        {collapsed ? (
          <BrandMark size={28} alt={branding.companyName} />
        ) : (
          <BrandWordmark height={38} alt={branding.companyName} />
        )}
      </div>

      {/* Collapsed, the gap to the nav was `mt-6` (24px) plus the nav's own
          divider margin, reading as a large dead band under the logo — tightened
          to sit close in both states. */}
      <div className={cn("flex flex-1 flex-col overflow-y-auto", collapsed ? "mt-3" : "mt-5")}>
        <SidebarNav role={session.user.role} />
      </div>

      {session.impersonatedBy && !collapsed && (
        <ImpersonationBanner adminName={session.impersonatedBy.displayName} />
      )}

      {/* px-2.5 collapsed matches SidebarNav's own collapsed padding exactly
          (sidebar-nav.tsx). SidebarNav also wraps each of its own rows in a
          `flex items-center` (collapsed: centered) container — this link
          sits outside that nav, so without the same `flex justify-center`
          here its size-9 pill stretched to the wrapper's full width instead
          of centering at a fixed 36px like every icon above it, reading as
          shifted left. */}
      <div className={cn("flex border-t border-[var(--sidebar-border)] pt-2", collapsed ? "justify-center px-2.5" : "px-3")}>
        <SupportNavLink />
      </div>

      <div className={cn("mt-3 border-t border-[var(--sidebar-border)] px-2.5 pt-3", collapsed && "px-2")}>
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <form
                action={logoutAction}
                className="flex justify-center"
                onSubmit={(e) => {
                  if (!confirm("Log out?")) e.preventDefault();
                }}
              >
                <button
                  type="submit"
                  className="brand-gradient flex size-9 items-center justify-center rounded-full text-[11px] font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
                  aria-label="Log out"
                >
                  {initials || "?"}
                </button>
              </form>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              {session.user.displayName}: Log out
            </TooltipContent>
          </Tooltip>
        ) : (
          <div className="flex items-center gap-2.5 rounded-xl border border-[var(--sidebar-border)] bg-[var(--sidebar-accent)]/60 px-2 py-2 transition-colors hover:bg-[var(--sidebar-accent)]">
            <div className="brand-gradient flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white">
              {initials || "?"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-foreground">{session.user.displayName}</p>
              <p className="truncate text-[11px] text-muted-foreground capitalize">
                {session.user.role.replace("_", " ")}
              </p>
            </div>
            <form
              action={logoutAction}
              onSubmit={(e) => {
                if (!confirm("Log out?")) e.preventDefault();
              }}
            >
              <button
                type="submit"
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-[var(--sidebar-accent)] hover:text-foreground"
                aria-label="Log out"
                title="Log out"
              >
                <LogOut className="size-3.5" />
              </button>
            </form>
          </div>
        )}
      </div>
    </aside>
  );
}
