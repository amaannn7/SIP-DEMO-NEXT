"use client";

import { LifeBuoy } from "lucide-react";
import { PillNavItem } from "@/components/shared/pill-nav-item";

function isSupportActive(pathname: string): boolean {
  return pathname === "/support" || pathname.startsWith("/support/");
}

/**
 * Deliberately outside SidebarNav's role-based Rep/Manager lists and its
 * "Team" (Chat) group — Feedback & Support isn't a workflow destination or a
 * collaboration channel, it's a standing utility link every role has, so it
 * sits on its own near the account footer instead of competing for space in
 * either grouped section above.
 */
export function SupportNavLink() {
  return <PillNavItem href="/support" label="Feedback & Support" icon={LifeBuoy} activeMatch={isSupportActive} />;
}
