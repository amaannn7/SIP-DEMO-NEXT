"use client";

import { useSidebarCollapse } from "./sidebar-collapse-context";
import { cn } from "@/lib/utils";

/**
 * The content column. Its left padding tracks `--sidebar-w` so it moves in the
 * same paint as the sidebar's width, and — like the sidebar — it only animates
 * once the stored collapse preference has been applied, so a restored-collapsed
 * layout doesn't slide into place on every page load.
 */
export function DashboardMain({ children }: { children: React.ReactNode }) {
  const { ready } = useSidebarCollapse();

  return (
    <main className={cn("pl-(--sidebar-w)", ready && "transition-[padding] duration-200 ease-out")}>
      {children}
    </main>
  );
}
