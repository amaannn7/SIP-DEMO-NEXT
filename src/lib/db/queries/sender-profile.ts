import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userSenderProfiles, orgSettings } from "@/lib/db/schema";

export type EffectiveSenderProfile = {
  senderName: string;
  senderTitle: string;
  senderCompany: string;
  calendarLink: string;
  emailTone: "professional" | "casual" | "friendly";
  companyDescription: string;
  valueProposition: string;
  socialProof: string;
  signature: string;
};

/** The rep's own fields, falling back to the org's AiBrandContext for company description/value prop/social proof/tone — same fallback-chain pattern as daily targets. */
export async function getEffectiveSenderProfile(orgId: string, userId: string): Promise<EffectiveSenderProfile> {
  const [profile, settings] = await Promise.all([
    db.query.userSenderProfiles.findFirst({ where: eq(userSenderProfiles.userId, userId) }),
    db.query.orgSettings.findFirst({ where: eq(orgSettings.orgId, orgId) }),
  ]);

  const brand = settings?.brandContext ?? {};

  return {
    senderName: profile?.senderName ?? "",
    senderTitle: profile?.senderTitle ?? "",
    senderCompany: profile?.senderCompany ?? "",
    calendarLink: profile?.calendarLink ?? "",
    emailTone: profile?.emailTone ?? "professional",
    companyDescription: profile?.companyDescription ?? brand.companyDescription ?? "",
    valueProposition: profile?.valueProposition ?? brand.valueProposition ?? "",
    socialProof: profile?.socialProof ?? brand.socialProof ?? "",
    signature: profile?.signature ?? "",
  };
}

export async function upsertSenderProfile(
  orgId: string,
  userId: string,
  fields: {
    senderName: string;
    senderTitle: string;
    senderCompany: string;
    calendarLink: string;
    emailTone: "professional" | "casual" | "friendly";
    companyDescription: string;
    valueProposition: string;
    socialProof: string;
    signature: string;
  },
): Promise<void> {
  await db
    .insert(userSenderProfiles)
    .values({ userId, orgId, ...fields })
    .onConflictDoUpdate({
      target: userSenderProfiles.userId,
      set: { ...fields, updatedAt: new Date() },
    });
}
