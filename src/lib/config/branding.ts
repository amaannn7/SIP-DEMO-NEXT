import type { OrgBrandingConfig } from "@/lib/db/schema";

/**
 * Defaults used when an org hasn't set a branding_config value yet (first
 * boot) or for a field left blank. Per-client forks should not need to edit
 * this file — set INITIAL_ORG_* env vars for first boot, or edit branding
 * via the admin UI afterward. This file only defines the *fallback*.
 */
export type ResolvedBranding = {
  companyName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  accentColor: string;
  sidebarColor: string;
};

export const DEFAULT_BRANDING: ResolvedBranding = {
  companyName: process.env.INITIAL_ORG_NAME ?? "Levata SIP",
  logoUrl: process.env.INITIAL_ORG_LOGO_URL ?? "/brand/levata-logo.png",
  faviconUrl: null,
  // Matches the brand gradient's violet/blue stops from the Levata mark.
  accentColor: process.env.INITIAL_ORG_ACCENT_COLOR ?? "#7B5BF0",
  sidebarColor: process.env.INITIAL_ORG_SIDEBAR_COLOR ?? "#7B5BF0",
};

export function resolveBranding(config: OrgBrandingConfig | null | undefined): ResolvedBranding {
  return {
    companyName: config?.companyName || DEFAULT_BRANDING.companyName,
    logoUrl: config?.logoUrl || DEFAULT_BRANDING.logoUrl,
    faviconUrl: config?.faviconUrl || DEFAULT_BRANDING.faviconUrl,
    accentColor: config?.accentColor || DEFAULT_BRANDING.accentColor,
    sidebarColor: config?.sidebarColor || DEFAULT_BRANDING.sidebarColor,
  };
}
