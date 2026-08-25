import { z } from "zod";
import { leadStageEnum, leadSourceEnum, leadTemperatureEnum } from "@/lib/db/schema";

const emptyToUndefined = (val: unknown) => (val === "" ? undefined : val);

export const leadStageSchema = z.enum(leadStageEnum.enumValues);
export const leadSourceSchema = z.enum(leadSourceEnum.enumValues);

// Shared per-field validators, with no defaults — defaults are applied
// separately per schema (create wants "" for name fields and "manual" for
// source; update must leave an omitted field untouched, not silently reset
// it, since a partial FormData from e.g. an inline single-field edit only
// carries the one key being changed).
const leadFieldSchemas = {
  firstName: z.preprocess(emptyToUndefined, z.string().trim().max(120).optional()),
  lastName: z.preprocess(emptyToUndefined, z.string().trim().max(120).optional()),
  email: z.preprocess(emptyToUndefined, z.string().trim().toLowerCase().email().optional()),
  phone: z.preprocess(emptyToUndefined, z.string().trim().max(40).optional()),
  company: z.preprocess(emptyToUndefined, z.string().trim().max(200).optional()),
  title: z.preprocess(emptyToUndefined, z.string().trim().max(150).optional()),
  industry: z.preprocess(emptyToUndefined, z.string().trim().max(150).optional()),
  country: z.preprocess(emptyToUndefined, z.string().trim().max(100).optional()),
  // Auto-prepends https:// when missing, matching the source system's
  // website-field behavior (a bare "example.com" is a common paste pattern).
  website: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .max(300)
      .transform((val) => (/^https?:\/\//i.test(val) ? val : `https://${val}`))
      .optional(),
  ),
  linkedin: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .max(300)
      .refine((val) => val.toLowerCase().includes("linkedin.com"), {
        message: "Enter a valid LinkedIn profile URL",
      })
      .optional(),
  ),
  companySize: z.preprocess(emptyToUndefined, z.string().trim().max(50).optional()),
  notes: z.preprocess(emptyToUndefined, z.string().trim().max(5000).optional()),
  callAnchor: z.preprocess(emptyToUndefined, z.string().trim().max(300).optional()),
  source: leadSourceSchema.optional(),
  sourceDetail: z.preprocess(emptyToUndefined, z.string().trim().max(200).optional()),
  ownerId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  stage: z.preprocess(emptyToUndefined, leadStageSchema.optional()),
};

export const leadInputSchema = z.object({
  ...leadFieldSchemas,
  firstName: leadFieldSchemas.firstName.default(""),
  lastName: leadFieldSchemas.lastName.default(""),
  source: leadFieldSchemas.source.default("manual"),
});

export type LeadInput = z.infer<typeof leadInputSchema>;

// No defaults on any field — an omitted key must mean "leave this column
// alone," not "reset it," since updateLeadAction spreads parsed.data
// directly into a partial db.update().set(...).
export const leadUpdateSchema = z.object(leadFieldSchemas);

export type LeadUpdateInput = z.infer<typeof leadUpdateSchema>;

export const leadListFiltersSchema = z.object({
  search: z.string().trim().max(200).optional(),
  stage: z.union([leadStageSchema, z.literal("all")]).default("all"),
  temperature: z.union([z.enum(leadTemperatureEnum.enumValues), z.literal("all")]).default("all"),
  ownerId: z.union([z.string().uuid(), z.literal("all")]).default("all"),
  page: z.coerce.number().int().min(1).default(1),
  // Capped at 500 (not 100) so the Kanban board — which fetches every active
  // stage in one call to render as columns, not one paginated table page —
  // can request BOARD_PER_PAGE (leads-explorer.tsx) without tripping this.
  perPage: z.coerce.number().int().min(1).max(500).default(25),
  trash: z
    .union([z.boolean(), z.string()])
    .transform((v) => (typeof v === "string" ? v === "true" : v))
    .default(false),
});

export type LeadListFilters = z.infer<typeof leadListFiltersSchema>;
