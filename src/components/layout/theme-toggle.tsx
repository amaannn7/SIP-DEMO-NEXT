"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Simple two-way Light/Dark switch. Previously cycled a third "System" state
 * that showed a monitor glyph — easy to mistake for a second, unrelated
 * button sitting next to the sun/moon toggle rather than a state of the same
 * control, so it's been dropped in favor of a plain on/off switch.
 *
 * Renders a neutral placeholder until mounted: the resolved theme isn't known
 * during SSR, so painting an icon before hydration would flash the wrong glyph.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";

  const base = cn(
    "flex size-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
    className,
  );

  if (!mounted) {
    return <div className={base} aria-hidden />;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          className={base}
          aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
        >
          {isDark ? <Moon className="size-4" strokeWidth={1.75} /> : <Sun className="size-4" strokeWidth={1.75} />}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={8}>
        Switch to {isDark ? "light" : "dark"} mode
      </TooltipContent>
    </Tooltip>
  );
}
