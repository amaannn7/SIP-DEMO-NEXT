import type { AiBrandContext } from "@/lib/db/schema";
import type { EffectiveSenderProfile } from "@/lib/db/queries/sender-profile";

const EMAIL_TONE_INSTRUCTIONS: Record<EffectiveSenderProfile["emailTone"], string> = {
  professional: "Direct, professional, no hype or exclamation marks.",
  casual: "Conversational and relaxed, like writing to a peer — contractions are fine, still no hype.",
  friendly: "Warm and personable, upbeat but not over the top — no exclamation marks stacked, no hype words.",
};

/** Merges a rep's My Context overrides on top of the org's default AiBrandContext — same fallback-chain pattern as daily targets. */
export function resolveEffectiveBrandContext(
  orgBrand: AiBrandContext,
  senderProfile: EffectiveSenderProfile | null,
): AiBrandContext {
  if (!senderProfile) return orgBrand;
  return {
    companyDescription: senderProfile.companyDescription || orgBrand.companyDescription,
    valueProposition: senderProfile.valueProposition || orgBrand.valueProposition,
    socialProof: senderProfile.socialProof || orgBrand.socialProof,
    toneGuidelines: orgBrand.toneGuidelines || EMAIL_TONE_INSTRUCTIONS[senderProfile.emailTone],
  };
}
