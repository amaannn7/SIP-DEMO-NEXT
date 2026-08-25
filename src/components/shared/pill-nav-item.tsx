"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSidebarCollapse } from "@/components/layout/sidebar-collapse-context";

type PillNavItemProps = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  /**
   * Extra path prefixes (beyond an exact match) that should also light this
   * item up — e.g. "/leads" stays active on "/leads/abc123" (a detail page,
   * not its own nav destination) without also matching "/leads/import" or
   * "/leads/new", which are separate nav items with their own hrefs.
   */
  activeMatch?: (pathname: string) => boolean;
  /**
   * Renders a plain <a> (full browser navigation) instead of next/link.
   * Needed for routes that collide with a sibling dynamic segment inside a
   * parallel-routes modal slot (e.g. /leads/new next to (.)leads/[id]) —
   * Next's client-side router can leave the previous page rendered under the
   * new URL in that situation; a full navigation sidesteps it.
   */
  hardNav?: boolean;
};

export function PillNavItem({ href, label, icon: Icon, badge, activeMatch, hardNav }: PillNavItemProps) {
  const pathname = usePathname();
  const { collapsed } = useSidebarCollapse();
  const isActive = activeMatch ? activeMatch(pathname) : pathname === href;
  const LinkComponent = hardNav ? "a" : Link;

  const link = (
    <LinkComponent
      href={href}
      className={cn(
        "group relative flex items-center rounded-lg text-[13px] font-medium transition-colors duration-150",
        // Collapsed: a square icon button (size-9, matching the logo/toggle),
        // not a full-width pill with the same vertical padding as the labeled
        // row — that padding is what was reading as an oversized gap between
        // icons. This is the tight icon-rail spacing modern sidebars (VS Code,
        // Linear, Notion) use once labels are hidden.
        collapsed ? "size-9 justify-center" : "gap-3 px-3 py-2.5",
        isActive
          ? // Solid brand-violet fill with a soft violet glow — the active
            // state is the loudest thing in the sidebar, by design.
            "bg-[var(--sidebar-primary)] text-[var(--sidebar-primary-foreground)] shadow-[0_2px_8px_0_color-mix(in_oklch,var(--primary)_25%,transparent)]"
          : "text-[var(--sidebar-foreground)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]",
      )}
    >
      <Icon className="size-[18px] shrink-0" strokeWidth={isActive ? 1.75 : 2} />
      {!collapsed && <span className="flex-1 truncate">{label}</span>}
      {badge !== undefined && badge > 0 && !collapsed && (
        <span
          className={cn(
            "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
            isActive
              ? "bg-white/25 text-current"
              : "bg-[color-mix(in_oklch,var(--primary)_14%,transparent)] text-[var(--primary)]",
          )}
        >
          {badge}
        </span>
      )}
      {badge !== undefined && badge > 0 && collapsed && (
        <span className="absolute top-1.5 right-2 size-1.5 rounded-full bg-[var(--accent)]" />
      )}
    </LinkComponent>
  );

  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {label}
        {badge !== undefined && badge > 0 && <span className="ml-1 opacity-70">({badge})</span>}
      </TooltipContent>
    </Tooltip>
  );
}
