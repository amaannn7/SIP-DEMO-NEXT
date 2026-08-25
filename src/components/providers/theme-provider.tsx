"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Light/dark theming, matching the reference design system: the whole app
 * inverts, not just the canvas. Every color token has a `:root` (light) and a
 * `.dark` value in globals.css.
 *
 * - `attribute="class"` toggles `.dark` on <html>, which is what the
 *   `@custom-variant dark` rule in globals.css keys off.
 * - `defaultTheme="system"` follows the OS until the user picks explicitly.
 * - `disableTransitionOnChange` suppresses the color transitions mid-switch so
 *   flipping themes is instant instead of a half-second smear of every surface.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
