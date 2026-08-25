"use server";

import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { apiKeys, orgSettings, llmProviderEnum, type AiBrandContext } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/session";
import { encryptApiKey, decryptApiKey } from "@/lib/ai/key-encryption";
import { groqProvider } from "@/lib/ai/providers/groq";
import { cerebrasProvider } from "@/lib/ai/providers/cerebras";
import { geminiProvider } from "@/lib/ai/providers/gemini";
import { anthropicProvider } from "@/lib/ai/providers/anthropic";
import type { LLMProvider } from "@/lib/ai/provider";

const providerSchema = z.enum(llmProviderEnum.enumValues);

const brandContextSchema = z.object({
  companyDescription: z.string().trim().max(2000).optional(),
  valueProposition: z.string().trim().max(2000).optional(),
  socialProof: z.string().trim().max(2000).optional(),
  toneGuidelines: z.string().trim().max(1000).optional(),
});

export async function updateBrandContextAction(
  _prevState: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const session = await requireRole("admin");

  const parsed = brandContextSchema.safeParse({
    companyDescription: formData.get("companyDescription") ?? undefined,
    valueProposition: formData.get("valueProposition") ?? undefined,
    socialProof: formData.get("socialProof") ?? undefined,
    toneGuidelines: formData.get("toneGuidelines") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const brandContext: AiBrandContext = parsed.data;

  await db
    .insert(orgSettings)
    .values({ orgId: session.user.orgId, brandContext })
    .onConflictDoUpdate({
      target: orgSettings.orgId,
      set: { brandContext, updatedAt: new Date() },
    });

  revalidatePath("/admin/settings");
  return {};
}

export async function updateProviderPreferenceAction(formData: FormData): Promise<void> {
  const session = await requireRole("admin");
  const parsed = providerSchema.safeParse(formData.get("provider"));
  if (!parsed.success) return;

  await db
    .insert(orgSettings)
    .values({ orgId: session.user.orgId, aiProviderPreference: parsed.data })
    .onConflictDoUpdate({
      target: orgSettings.orgId,
      set: { aiProviderPreference: parsed.data, updatedAt: new Date() },
    });

  revalidatePath("/admin/settings");
}

const apiKeyFormSchema = z.object({
  provider: providerSchema,
  apiKey: z.string().trim().min(8, "API key looks too short"),
});

export async function saveApiKeyAction(
  _prevState: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const session = await requireRole("admin");

  const parsed = apiKeyFormSchema.safeParse({
    provider: formData.get("provider"),
    apiKey: formData.get("apiKey"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { encryptedKey, keyNonce } = encryptApiKey(parsed.data.apiKey);

  await db
    .insert(apiKeys)
    .values({
      orgId: session.user.orgId,
      provider: parsed.data.provider,
      encryptedKey,
      keyNonce,
      isActive: true,
    })
    .onConflictDoUpdate({
      target: [apiKeys.orgId, apiKeys.provider],
      set: { encryptedKey, keyNonce, isActive: true, updatedAt: new Date() },
    });

  revalidatePath("/admin/settings");
  return {};
}

export async function deleteApiKeyAction(provider: string): Promise<void> {
  const session = await requireRole("admin");
  const parsed = providerSchema.safeParse(provider);
  if (!parsed.success) return;

  await db.delete(apiKeys).where(and(eq(apiKeys.orgId, session.user.orgId), eq(apiKeys.provider, parsed.data)));

  revalidatePath("/admin/settings");
}

const PROVIDER_IMPLS: Record<(typeof llmProviderEnum.enumValues)[number], LLMProvider> = {
  groq: groqProvider,
  cerebras: cerebrasProvider,
  gemini: geminiProvider,
  anthropic: anthropicProvider,
};

export type TestConnectionResult = { success: boolean; error?: string };

/** Sends a minimal real request using the stored key for one provider — the AI Settings "Test" button. */
export async function testApiKeyAction(provider: string): Promise<TestConnectionResult> {
  const session = await requireRole("admin");
  const parsed = providerSchema.safeParse(provider);
  if (!parsed.success) return { success: false, error: "Unknown provider" };

  const row = await db.query.apiKeys.findFirst({
    where: and(eq(apiKeys.orgId, session.user.orgId), eq(apiKeys.provider, parsed.data)),
  });
  if (!row) return { success: false, error: "No key saved for this provider" };

  const apiKey = decryptApiKey(row.encryptedKey, row.keyNonce);
  const result = await PROVIDER_IMPLS[parsed.data].generateText('Reply with exactly one word: "ok".', apiKey);

  return result.success ? { success: true } : { success: false, error: result.error };
}
