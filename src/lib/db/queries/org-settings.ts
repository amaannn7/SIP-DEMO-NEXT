import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { orgSettings, icpFields, apiKeys, type AiBrandContext } from "@/lib/db/schema";
import type { FitGradeThresholds } from "@/lib/scoring/fit-score";
import type { IcpFieldDef } from "@/lib/scoring/fit-score";
import { maskApiKey, decryptApiKey } from "@/lib/ai/key-encryption";

const DEFAULT_THRESHOLDS: FitGradeThresholds = {
  gradeAThreshold: 80,
  gradeBThreshold: 60,
  gradeCThreshold: 40,
};

export async function getFitGradeThresholds(orgId: string): Promise<FitGradeThresholds> {
  const settings = await db.query.orgSettings.findFirst({
    where: eq(orgSettings.orgId, orgId),
  });
  if (!settings) return DEFAULT_THRESHOLDS;
  return {
    gradeAThreshold: settings.fitGradeAThreshold,
    gradeBThreshold: settings.fitGradeBThreshold,
    gradeCThreshold: settings.fitGradeCThreshold,
  };
}

export async function getSlaMaxDaysByStage(orgId: string): Promise<Partial<Record<string, number>>> {
  const settings = await db.query.orgSettings.findFirst({
    where: eq(orgSettings.orgId, orgId),
  });
  return (
    settings?.slaMaxDaysByStage ?? {
      new_lead: 1,
      research: 1,
      email_sent: 5,
      call_attempted: 3,
      engaged: 7,
      consultation_booked: 14,
      nurture_parked: 90,
    }
  );
}

export async function listIcpFieldRows(orgId: string) {
  return db.query.icpFields.findMany({
    where: eq(icpFields.orgId, orgId),
    orderBy: (fields, { asc }) => [asc(fields.sortOrder)],
  });
}

/** Enabled fields only — for scoring, the lead qualification form, and anywhere else a field should behave as if it doesn't exist while disabled. Admin settings management uses listIcpFieldRows directly to also see disabled fields. */
export async function listIcpFields(orgId: string): Promise<IcpFieldDef[]> {
  const rows = await listIcpFieldRows(orgId);
  return rows
    .filter((r) => r.isEnabled)
    .map((r) => ({
      key: r.key,
      label: r.label,
      subtitle: r.subtitle,
      fieldType: r.fieldType,
      options: r.options,
      weight: r.weight,
      isRequired: r.isRequired,
    }));
}

export async function getAiProviderPreference(orgId: string) {
  const settings = await db.query.orgSettings.findFirst({ where: eq(orgSettings.orgId, orgId) });
  return settings?.aiProviderPreference ?? "groq";
}

export async function getBrandContext(orgId: string): Promise<AiBrandContext> {
  const settings = await db.query.orgSettings.findFirst({ where: eq(orgSettings.orgId, orgId) });
  return settings?.brandContext ?? {};
}

export type MaskedApiKey = { provider: string; masked: string; isActive: boolean };

/** Decrypts each key only to mask it for display — the plaintext never leaves this function. */
export async function listMaskedApiKeys(orgId: string): Promise<MaskedApiKey[]> {
  const rows = await db.query.apiKeys.findMany({ where: eq(apiKeys.orgId, orgId) });
  return rows.map((row) => ({
    provider: row.provider,
    masked: maskApiKey(decryptApiKey(row.encryptedKey, row.keyNonce)),
    isActive: row.isActive,
  }));
}
