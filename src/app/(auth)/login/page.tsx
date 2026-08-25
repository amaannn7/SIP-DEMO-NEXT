import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { DEFAULT_BRANDING } from "@/lib/config/branding";
import Image from "next/image";
import { LoginForm } from "./login-form";
import { LoginArtPanel } from "./login-art-panel";

/**
 * Floating split card on a plain grey canvas — the light form half and the
 * permanently-dark relationship-graph half live inside one rounded,
 * shadowed card, matching the reference's structure exactly rather than
 * going edge-to-edge. The card's own halves don't follow the app's
 * light/dark toggle: the light-left/dark-right split IS the design here,
 * the same way the reference's is, so there's no theme control on this
 * screen at all.
 */
export default async function LoginPage() {
  const session = await getSession();
  if (session) {
    const isManager = session.user.role === "admin" || session.user.role === "super_admin";
    redirect(isManager ? "/admin" : "/dashboard");
  }

  const company = DEFAULT_BRANDING.companyName;

  return (
    // fixed + inset-0 (not min-h-screen) — the root layout's <body> is
    // `min-h-full`, a floor not a ceiling, so a merely-h-screen page can
    // still make body taller than the viewport and force a page scrollbar
    // if it's even a pixel over. Pinning to the viewport directly removes
    // this page from that flow calculation entirely.
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden bg-[oklch(0.94_0.004_285)] p-6">
      <div className="grid h-full max-h-[46rem] w-full max-w-6xl overflow-hidden rounded-3xl bg-white shadow-[0_30px_80px_-20px_rgba(0,0,0,0.25)] lg:grid-cols-2">
        {/* Left: the form. Independent overflow-y-auto so a very short
            viewport scrolls just this half, never the page — see the
            comment on the outer wrapper of the dark panel for why this
            can't share a scroll container with an oversized decorative
            element. */}
        {/* This half is permanently light regardless of the app's dark-mode
            setting (see the file comment), but LoginForm's own classes
            (bg-card, text-foreground, border-input, etc.) are theme tokens
            that flip with .dark on <html> — pinning them to their light
            values here, scoped to just this column, keeps LoginForm itself
            reusable/theme-reactive for any other context while guaranteeing
            readable fields on this always-light surface. */}
        <div
          className="relative flex flex-col overflow-y-auto px-8 py-8 sm:px-14 sm:py-10"
          style={
            {
              "--background": "oklch(0.985 0.003 280)",
              "--foreground": "oklch(0.2 0.02 285)",
              "--card": "oklch(1 0 0)",
              "--muted-foreground": "oklch(0.53 0.02 285)",
              "--input": "oklch(0.9 0.008 285)",
              "--destructive": "oklch(0.58 0.23 25)",
            } as React.CSSProperties
          }
        >
          {/* Pinned to the card's own top-left corner (absolute, not part of
              the padded content flow) — matches the reference's logo
              placement, flush with the card edge rather than indented with
              the form below it. */}
          {/* The light-variant wordmark asset specifically (not the
              theme-following BrandWordmark component) — must always render
              its dark-text-on-transparent version here, never the
              white-text dark-mode variant that would go invisible on this
              permanently-light surface. */}
          {/* width/height are intrinsic size hints Next uses to pick which
              generated asset to serve — set close to the actual final
              display size (not the full 829x253 source) so the browser
              renders it near 1:1 instead of down-scaling a much larger
              image, which is what was still coming out soft. */}
          <Image
            src="/brand/levata-logo.png"
            alt={company}
            width={164}
            height={50}
            className="absolute top-6 left-6 h-7 w-auto sm:top-8 sm:left-8"
            priority
          />

          <div className="flex flex-1 flex-col items-center justify-center py-8">
            <div className="w-full max-w-sm">
              <h1 className="text-[26px] font-bold tracking-tight text-neutral-900">Login to your account</h1>
              <p className="mt-1.5 text-sm text-neutral-500">Sign in to your {company} account.</p>

              <div className="mt-7">
                <LoginForm />
              </div>
            </div>
          </div>

          <p className="text-center text-xs text-neutral-400 sm:text-left">
            Protected by encrypted sessions. Contact your administrator for access.
          </p>
        </div>

        <LoginArtPanel />
      </div>
    </div>
  );
}
