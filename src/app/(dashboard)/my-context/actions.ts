"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/session";
import { upsertSenderProfile } from "@/lib/db/queries/sender-profile";
import { emailToneEnum } from "@/lib/db/schema";

const senderProfileSchema = z.object({
  senderName: z.string().trim().max(150).optional().default(""),
  senderTitle: z.string().trim().max(150).optional().default(""),
  senderCompany: z.string().trim().max(200).optional().default(""),
  calendarLink: z.string().trim().max(300).optional().default(""),
  emailTone: z.enum(emailToneEnum.enumValues).optional().default("professional"),
  companyDescription: z.string().trim().max(2000).optional().default(""),
  valueProposition: z.string().trim().max(2000).optional().default(""),
  socialProof: z.string().trim().max(2000).optional().default(""),
  signature: z.string().trim().max(2000).optional().default(""),
});

export type SaveSenderProfileState = { error?: string; success?: boolean };

export async function saveSenderProfileAction(
  _prevState: SaveSenderProfileState,
  formData: FormData,
): Promise<SaveSenderProfileState> {
  const session = await requireAuth();

  const parsed = senderProfileSchema.safeParse({
    senderName: formData.get("senderName") ?? undefined,
    senderTitle: formData.get("senderTitle") ?? undefined,
    senderCompany: formData.get("senderCompany") ?? undefined,
    calendarLink: formData.get("calendarLink") ?? undefined,
    emailTone: formData.get("emailTone") || undefined,
    companyDescription: formData.get("companyDescription") ?? undefined,
    valueProposition: formData.get("valueProposition") ?? undefined,
    socialProof: formData.get("socialProof") ?? undefined,
    signature: formData.get("signature") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await upsertSenderProfile(session.user.orgId, session.user.id, parsed.data);

  revalidatePath("/my-context");
  return { success: true };
}
