import type { Metadata } from "next";
import { Outfit, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryProvider } from "@/components/providers/query-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import "./globals.css";

// Outfit — the typeface the reference design system (shadcn UI Kit) actually
// applies by default (`--text-family: var(--font-outfit)`), not one of the
// alternatives its theme customizer merely offers. A geometric sans with
// near-circular bowls, a tall x-height and very even stroke weight: it reads
// modern and friendly where the previous Inter build read neutral/corporate,
// and its 600/700 weights give KPI numerals real presence.
//
// Embedded rather than pulled from a system stack so every visitor sees the
// same intentional look regardless of OS.
const bodyFont = Outfit({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

// Outfit is also the display face — the reference uses one family throughout
// rather than pairing, so `--font-display` is aliased to `--font-sans` on
// <html> below and drives h1–h4 via globals.css.
const monoFont = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Levata SIP",
  description: "AI-powered sales intelligence and pipeline CRM",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      // suppressHydrationWarning: next-themes writes the resolved theme class
      // onto <html> before React hydrates, so server and client markup differ
      // here by design.
      suppressHydrationWarning
      className={`${bodyFont.variable} ${monoFont.variable} h-full antialiased`}
      style={{ "--font-display": "var(--font-sans)" } as React.CSSProperties}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <QueryProvider>
            <TooltipProvider>
              {children}
              <Toaster />
            </TooltipProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
