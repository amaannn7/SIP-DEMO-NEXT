"use client";

import {
  LayoutDashboard,
  Users2,
  Upload,
  UserPlus,
  UserCog,
  BarChart3,
  GitBranch,
  Activity,
  ShieldCheck,
  Settings,
  LayoutGrid,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PillNavItem } from "@/components/shared/pill-nav-item";
import { ChatNavItem } from "./chat-nav-item";
import { useSidebarCollapse } from "./sidebar-collapse-context";
import type { UserRole } from "@/lib/auth/session";

// Mirrors the source system's role-differentiated nav: a rep's workflow
// (Today/Leads/Import/Add Lead/My Context) is a completely different list
// than a manager's (Admin Dashboard/Reports/Pipeline/Team Activity/Users),
// swapped in binary fashion by role — never both shown at once.
const REP_NAV_ITEMS = [
  { href: "/dashboard", label: "Today", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users2 },
  { href: "/workbench", label: "Workbench", icon: LayoutGrid },
  { href: "/leads/import", label: "Import", icon: Upload },
  { href: "/leads/new", label: "Add Lead", icon: UserPlus },
  { href: "/my-context", label: "My Context", icon: UserCog },
];

// Matches the source system's Admin Panel: a single consolidated settings
// page as its own top-level nav item, not nested under the dashboard.
//
// "My Context" (the per-user sender identity/tone page — name, title,
// signature, email tone) is NOT a top-level item here, unlike the rep list —
// a manager reaches it as a card inside Settings instead, since managers
// already have a Settings destination reps don't. It still has no role guard
// of its own (any authenticated user can reach /my-context directly); this
// is purely about where the nav entry point lives for each role.
// Reports and Settings were previously super_admin-only here, but the
// legacy source (api.php: admin-settings/activity-report/calls-report/
// activity-feed) gates all of these to requireAdmin(), not
// requireSuperAdmin() — a plain admin sees the same pages, just with
// certain content filtered server-side (Aircall in Settings; other
// super_admins' rows in Reports). See the pages themselves for that
// filtering.
const MANAGER_NAV_ITEMS = [
  { href: "/admin", label: "Admin Dashboard", icon: LayoutDashboard, superAdminOnly: false },
  { href: "/reports", label: "Reports", icon: BarChart3, superAdminOnly: false },
  { href: "/leads", label: "Pipeline", icon: GitBranch, superAdminOnly: false },
  { href: "/workbench", label: "Workbench", icon: LayoutGrid, superAdminOnly: false },
  { href: "/dashboard", label: "Team Activity", icon: Activity, superAdminOnly: false },
  { href: "/admin/users", label: "Users", icon: ShieldCheck, superAdminOnly: false },
  { href: "/admin/settings", label: "Settings", icon: Settings, superAdminOnly: false },
];

const isManager = (role: UserRole) => role === "admin" || role === "super_admin";

// "/leads" stays highlighted on a lead's own detail page ("/leads/<uuid>"),
// but not on "/leads/import" or "/leads/new" — those are distinct nav items.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isLeadsActive(pathname: string): boolean {
  if (pathname === "/leads") return true;
  const match = pathname.match(/^\/leads\/([^/]+)$/);
  return Boolean(match && UUID_RE.test(match[1]));
}

export function SidebarNav({ role, focusQueueCount }: { role: UserRole; focusQueueCount?: number }) {
  const { collapsed } = useSidebarCollapse();
  // Binary swap, matching the source system's applyRoleNavigation exactly:
  // a manager sees ONLY the manager list, a rep sees ONLY the rep list —
  // never both stacked in the same sidebar.
  const items = isManager(role) ? MANAGER_NAV_ITEMS.filter((item) => !item.superAdminOnly || role === "super_admin") : REP_NAV_ITEMS;
  const sectionLabel = isManager(role) ? "Manager" : "Rep workflow";

  return (
    // Collapsed, the padding tightens and the section eyebrows are replaced by
    // a hairline divider — dropping the labels outright left uneven gaps that
    // made the icon rail look misaligned.
    <nav className={cn("flex flex-1 flex-col", collapsed ? "gap-2 px-2.5" : "gap-3 px-3")}>
      <div>
        {collapsed ? (
          <div className="mx-auto mb-1.5 h-px w-6 bg-[var(--sidebar-border)]" aria-hidden />
        ) : (
          <p className="px-2 pb-1.5 text-[10px] font-semibold tracking-wider text-muted-foreground/70 uppercase">{sectionLabel}</p>
        )}
        <div className={cn("flex flex-col gap-0.5", collapsed && "items-center")}>
          {items.map((item) => (
            <PillNavItem
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              badge={item.href === "/leads" ? focusQueueCount : undefined}
              activeMatch={item.href === "/leads" ? isLeadsActive : undefined}
              hardNav={item.href === "/leads/new" || item.href === "/leads/import"}
            />
          ))}
        </div>
      </div>

      {/* Visible regardless of role — unlike the two lists above, chat isn't role-specific. */}
      <div>
        {collapsed ? (
          <div className="mx-auto mb-2 h-px w-6 bg-[var(--sidebar-border)]" aria-hidden />
        ) : (
          <p className="px-2 pb-1.5 text-[10px] font-semibold tracking-wider text-muted-foreground/70 uppercase">Team</p>
        )}
        <div className={cn("flex flex-col gap-0.5", collapsed && "items-center")}>
          <ChatNavItem />
        </div>
      </div>
    </nav>
  );
}
