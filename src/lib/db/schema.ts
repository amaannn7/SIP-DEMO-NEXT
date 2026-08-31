import { relations, sql } from "drizzle-orm";
import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  real,
  jsonb,
  uuid,
  uniqueIndex,
  index,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const userRoleEnum = pgEnum("user_role", ["rep", "admin", "super_admin"]);

// Single stage enum — no legacy status/stage dual-tracking (the source
// system carried both a `status` field and a newer `stage` field with a
// compatibility layer mapping between them; that mid-migration mess is
// exactly what moving to a real relational schema retires).
export const leadStageEnum = pgEnum("lead_stage", [
  "new_lead",
  "research",
  "email_sent",
  "call_attempted",
  "engaged",
  "consultation_booked",
  "nurture_parked",
  "won",
  "lost",
]);

export const leadSourceEnum = pgEnum("lead_source", ["import", "inbound", "manual", "other"]);

export const leadTemperatureEnum = pgEnum("lead_temperature", ["on_fire", "hot", "warm", "cold"]);
export const leadVelocityEnum = pgEnum("lead_velocity", ["accelerating", "stable", "slowing", "stalled"]);
export const leadFitGradeEnum = pgEnum("lead_fit_grade", ["A", "B", "C", "Disqualified", "Unscored"]);

export const llmProviderEnum = pgEnum("llm_provider", ["groq", "gemini", "anthropic", "cerebras"]);
export const emailSequenceStepEnum = pgEnum("email_sequence_step", ["initial", "followup1", "followup2", "breakup"]);
// Mirrors call outcomes but for a sent email: a rep marks it manually since
// there's no inbound email/reply integration — replied/meeting_booked
// auto-advance the lead's stage the same way a positive call outcome does.
export const emailOutcomeEnum = pgEnum("email_outcome", ["replied", "bounced", "no_response", "meeting_booked"]);
// Ports the source system's exact 4 Skip Email reasons — choosing one jumps
// the lead straight to call_attempted (bypassing the emailsSentCount>0 gate
// on the Call tab) without ever actually sending an email.
export const emailSkipReasonEnum = pgEnum("email_skip_reason", ["already_contacted", "phone_preferred", "referral", "other"]);
export const callPitchTypeEnum = pgEnum("call_pitch_type", [
  "cold_with_email",
  "cold_no_email",
  "callback",
  "discovery",
  "demo",
]);
export const jobTypeEnum = pgEnum("job_type", ["enrich_lead", "generate_email", "generate_call_pitch", "score_call"]);
export const jobStatusEnum = pgEnum("job_status", ["pending", "processing", "completed", "failed"]);

// Manual call-outcome logging (Phase 4) — a rep logs the result themselves
// after making a call; no dialer/Aircall integration in this build.
export const callOutcomeEnum = pgEnum("call_outcome", [
  "no_answer_retry",
  "left_voicemail",
  "gatekeeper",
  "wrong_number",
  "not_interested",
  "interested_followup",
  "consultation_booked",
  "callback_requested",
  "not_right_time_park_90",
]);

// The source system's 4 fixed "Next Action" options, captured alongside the
// outcome on the same call-outcome save (macktilesCallOutcomeConfig / Step 4
// of the Outcome tab wizard). The rep's choice here can override the
// outcome's default stage transition — see STAGE_BY_OUTCOME in
// call-log-actions.ts for the exact two-case override logic ported from api.php.
export const nextActionEnum = pgEnum("next_action", [
  "followup_email",
  "followup_date",
  "consultation_booked",
  "nurture_parked",
]);

/** Outcomes that count as a positive signal for engagement scoring. */
export const POSITIVE_CALL_OUTCOMES = new Set<string>([
  "interested_followup",
  "consultation_booked",
  "callback_requested",
]);

// A call_logs row created by the manual "I'm calling now" flow vs. one
// created automatically from an Aircall webhook event.
export const callViaEnum = pgEnum("call_via", ["manual", "aircall"]);
export const callDirectionEnum = pgEnum("call_direction", ["inbound", "outbound"]);
export const transcriptStatusEnum = pgEnum("transcript_status", ["pending", "ready", "failed", "skipped"]);
// Ports the source system's classifyCall() 6-bucket outcome exactly.
export const callScoreClassificationEnum = pgEnum("call_score_classification", [
  "correctly_disqualified",
  "effective_call",
  "well_handled_no_immediate_progress",
  "positive_result_execution_risk",
  "ineffective_call",
  "mixed_result",
]);

// ---------------------------------------------------------------------------
// organizations
//
// One row per deployment in the template-repo model, but modeled as a real
// table (not a hardcoded constant) so branding/config is data-driven and a
// future shared-tenant deployment doesn't require a schema change.
// ---------------------------------------------------------------------------

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  brandingConfig: jsonb("branding_config").$type<OrgBrandingConfig>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type OrgBrandingConfig = {
  companyName?: string;
  logoUrl?: string;
  faviconUrl?: string;
  accentColor?: string; // e.g. "#e3705a"
  sidebarColor?: string; // e.g. "#263238"
};

// ---------------------------------------------------------------------------
// users
// ---------------------------------------------------------------------------

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    displayName: text("display_name").notNull(),
    role: userRoleEnum("role").notNull().default("rep"),
    avatarUrl: text("avatar_url"),
    isActive: boolean("is_active").notNull().default(true),
    // First-login welcome wizard (sender profile -> brand context -> tips).
    // Seeded demo/client accounts default to true so pre-populated fixtures
    // don't show a wizard prompting for data they already have; only a
    // freshly created user (via Users -> Add user) sees it.
    hasCompletedOnboarding: boolean("has_completed_onboarding").notNull().default(true),
    // Per-rep Aircall linking, set by an admin on the Users page — the
    // Aircall user/number ids found in that rep's Aircall dashboard, needed
    // to trigger a click-to-dial call on their behalf.
    aircallUserId: text("aircall_user_id"),
    aircallNumberId: text("aircall_number_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Scoped per-org rather than globally unique: the template model runs one
    // org per deployment today, but keeps the door open to a shared-tenant
    // deployment later without a schema change.
    uniqueIndex("users_org_id_email_idx").on(table.orgId, table.email),
  ],
);

export const emailToneEnum = pgEnum("email_tone", ["professional", "casual", "friendly"]);
export const dailyCommitmentActionEnum = pgEnum("daily_commitment_action", ["call", "email", "research", "other"]);

// ---------------------------------------------------------------------------
// user_sender_profiles ("My Context")
//
// Per-rep sender identity + AI email context — the source system's "My
// Context" page. companyDescription/valueProposition/socialProof/tone here
// are OVERRIDES of the org-wide AiBrandContext (org_settings.brand_context);
// null means "use the org default", same fallback-chain pattern as
// daily_targets (personal override -> org default). One row per user.
// ---------------------------------------------------------------------------

export const userSenderProfiles = pgTable("user_sender_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  senderName: text("sender_name"),
  senderTitle: text("sender_title"),
  senderCompany: text("sender_company"),
  calendarLink: text("calendar_link"),
  emailTone: emailToneEnum("email_tone"),
  companyDescription: text("company_description"),
  valueProposition: text("value_proposition"),
  socialProof: text("social_proof"),
  signature: text("signature"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// sessions
//
// Server-side sessions rather than JWTs so logout-everywhere / admin-forced
// logout / impersonation are all plain row operations. `impersonatedBy` is
// non-null exactly when this session belongs to an admin who is currently
// impersonating `userId` — makes impersonation first-class and auditable
// instead of a bolted-on hack.
// ---------------------------------------------------------------------------

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    impersonatedBy: uuid("impersonated_by").references(() => users.id, {
      onDelete: "cascade",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    // Presence tracking — ports the source system's activity-ping/user-sessions
    // admin widget ("online now", "last seen", "last page"). Updated by a
    // lightweight ping from the authenticated shell, not on every request.
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    lastPage: text("last_page"),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)],
);

// ---------------------------------------------------------------------------
// password_reset_tokens
//
// Ports the source system's request-password-reset/reset-password: a
// short-lived (1 hour) single-use token. No outbound email delivery exists
// in this template (the source system didn't have one either — it returned
// the token directly for an admin to relay), so the reset link is shown
// on-screen after a request; wiring real email delivery later doesn't
// require touching the token logic itself.
// ---------------------------------------------------------------------------

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("password_reset_tokens_token_idx").on(table.token), index("password_reset_tokens_user_id_idx").on(table.userId)],
);

// Brute-force protection on login — not present in the source system (its
// only rate limiting was a generic 120-req/60s per-IP API throttle, not
// attempt-tracking), added as a genuine security improvement. One row per
// failed attempt; a sliding window of recent rows per identifier decides
// lockout, and a successful login clears the identifier's history.
export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // ip:email, lowercased — locks out that specific IP+email pairing rather
    // than the account globally, so one attacker can't lock a real user out
    // of their own account from a different IP.
    identifier: text("identifier").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("login_attempts_identifier_created_at_idx").on(table.identifier, table.createdAt)],
);

// ---------------------------------------------------------------------------
// leads
//
// Core Phase 1 fields only — the scoring engine (fit/engagement/temperature/
// SLA/velocity) lands in Phase 2 and adds its own columns then, rather than
// pre-building placeholder columns now (Phase 1 comment — Phase 2 below adds
// them). `zohoRecordId` supports duplicate detection on re-import (mirrors
// the source system's Zoho-export dedupe behavior) without pulling in a
// full Zoho integration.
//
// Scoring columns (fitScore/engagementScore/temperature/velocity/fitGrade)
// are denormalized — recomputed by lib/scoring/recompute.ts on relevant
// writes, not calculated per-read, so list views can filter/sort by them
// with real SQL instead of loading every lead into memory to score it.
// ---------------------------------------------------------------------------

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),

    firstName: text("first_name").notNull().default(""),
    lastName: text("last_name").notNull().default(""),
    email: text("email"),
    phone: text("phone"),
    company: text("company"),
    title: text("title"),
    industry: text("industry"),
    country: text("country"),
    website: text("website"),
    linkedin: text("linkedin"),
    companySize: text("company_size"),
    notes: text("notes"),

    stage: leadStageEnum("stage").notNull().default("new_lead"),
    source: leadSourceEnum("source").notNull().default("manual"),
    sourceDetail: text("source_detail"),

    zohoRecordId: text("zoho_record_id"),

    // Answers to the org's configurable ICP fields (see icpFields), keyed by
    // icpFields.key. Generic on purpose — no hardcoded industry-specific
    // column names.
    customFields: jsonb("custom_fields").$type<Record<string, unknown>>().notNull().default({}),

    // --- Scoring (Phase 2) ---
    fitScore: integer("fit_score"),
    fitGrade: leadFitGradeEnum("fit_grade"),
    fitFactors: jsonb("fit_factors").$type<string[]>().notNull().default([]),
    fitDisqualifiers: jsonb("fit_disqualifiers").$type<string[]>().notNull().default([]),
    engagementScore: integer("engagement_score"),
    temperature: leadTemperatureEnum("temperature"),
    velocity: leadVelocityEnum("velocity"),
    scoresUpdatedAt: timestamp("scores_updated_at", { withTimezone: true }),
    // Ports the source system's grade_override: an annotation a rep can add
    // to document why they're proceeding on a lead despite its grade (e.g. a
    // warm referral) — informational only, never changes fitGrade itself or
    // unlocks anything that wasn't already available.
    gradeOverride: jsonb("grade_override").$type<{
      reason: string;
      notes: string;
      overriddenBy: string;
      overriddenAt: string;
      originalGrade: string;
    } | null>(),

    // --- AI (Phase 3) ---
    // hasEnrichment mirrors "was enrichment ever completed" (the source
    // system's own engagement-score input) without needing to join
    // enrichment_results just to know whether it ran.
    hasEnrichment: boolean("has_enrichment").notNull().default(false),
    emailsSentCount: integer("emails_sent_count").notNull().default(0),
    lastEmailStep: emailSequenceStepEnum("last_email_step"),
    // Set when a rep explicitly skips the Email step (source system's Skip
    // Email flow) rather than ever sending — see emailSkipReasonEnum.
    emailSkipped: emailSkipReasonEnum("email_skipped"),
    // Manual call logging (Phase 4) — no Aircall/dialer integration; a rep
    // logs the outcome themselves after a call. Denormalized here for the
    // same reason as emailsSentCount: the engagement-score input needs a
    // cheap read, not a join against call_logs on every recompute.
    callsMadeCount: integer("calls_made_count").notNull().default(0),
    lastCallOutcome: callOutcomeEnum("last_call_outcome"),
    // Ports the source system's call_anchor: a short rep-editable note ("what
    // to remember for next contact") that feeds both the next-best-action
    // callback talking point and call-pitch generation.
    callAnchor: text("call_anchor"),

    // --- Follow-up / snooze (drives Focus Queue + SLA) ---
    followupDate: timestamp("followup_date", { withTimezone: true }),
    skippedUntil: timestamp("skipped_until", { withTimezone: true }),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }),

    // Optional free-text reason captured when a lead is marked Lost —
    // matches the source system's Mark as Lost prompt. Won has no
    // equivalent field.
    rejectionReason: text("rejection_reason"),

    isDeleted: boolean("is_deleted").notNull().default(false),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("leads_org_id_idx").on(table.orgId),
    index("leads_owner_id_idx").on(table.ownerId),
    index("leads_stage_idx").on(table.stage),
    index("leads_temperature_idx").on(table.temperature),
    index("leads_org_id_email_idx").on(table.orgId, table.email),
    index("leads_org_id_zoho_record_id_idx").on(table.orgId, table.zohoRecordId),
  ],
);

// ---------------------------------------------------------------------------
// icp_fields
//
// Data-driven Ideal Customer Profile qualification fields — replaces the
// source system's hardcoded industry-specific requisitions (segment/
// decision-role/project-type/etc. baked into calculateLeadGrade). Each org
// defines its own fields; fitScoreEngine reads them generically by `key`
// and `weight`, never by a hardcoded field name.
// ---------------------------------------------------------------------------

export const icpFieldTypeEnum = pgEnum("icp_field_type", ["text", "number", "boolean", "select", "multiselect"]);

export const icpFields = pgTable(
  "icp_fields",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    label: text("label").notNull(),
    // Ports the source system's requisitions[].subtitle — a short prompt
    // shown under the question in the lead qualification form.
    subtitle: text("subtitle"),
    fieldType: icpFieldTypeEnum("field_type").notNull().default("select"),
    // For select/multiselect: [{ value, label, weight, isIdeal }]. `weight`
    // is the points this option contributes toward fitScore when selected;
    // `isIdeal` marks the top-priority option(s) for that field (mirrors the
    // source system's ideal_segments/later_segments split, generalized to
    // any field instead of being hardcoded to "segment").
    options: jsonb("options").$type<IcpFieldOption[]>(),
    weight: integer("weight").notNull().default(0),
    isRequired: boolean("is_required").notNull().default(false),
    // Ports the source system's requisitions[].enabled toggle — a disabled
    // field is hidden from the lead qualification form and excluded from fit
    // scoring, without deleting its configuration (an admin can turn it back
    // on later with its options/weight intact).
    isEnabled: boolean("is_enabled").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("icp_fields_org_id_key_idx").on(table.orgId, table.key),
    index("icp_fields_org_id_idx").on(table.orgId),
  ],
);

export type IcpFieldOption = {
  value: string;
  label: string;
  weight: number; // fraction of the field's total weight this option earns (0-1)
  isIdeal?: boolean;
  // Mirrors the source system's hardcoded disqualifier rules (e.g. wrong
  // segment, not a decision-maker), generalized to any field instead of a
  // fixed set of conditions — selecting this option always adds a
  // disqualifier, regardless of the score it also earns.
  isDisqualifying?: boolean;
};

// ---------------------------------------------------------------------------
// org_settings
//
// SLA thresholds and fit-grade thresholds, configurable per org rather than
// hardcoded — replaces admin.stage_validation_rules from the source system.
// One row per organization.
// ---------------------------------------------------------------------------

export const orgSettings = pgTable("org_settings", {
  orgId: uuid("org_id")
    .primaryKey()
    .references(() => organizations.id, { onDelete: "cascade" }),
  fitGradeAThreshold: integer("fit_grade_a_threshold").notNull().default(80),
  fitGradeBThreshold: integer("fit_grade_b_threshold").notNull().default(60),
  fitGradeCThreshold: integer("fit_grade_c_threshold").notNull().default(40),
  // SLA max-days-in-stage per lead stage, keyed by leadStageEnum value.
  slaMaxDaysByStage: jsonb("sla_max_days_by_stage").$type<Partial<Record<string, number>>>().notNull().default({
    new_lead: 1,
    research: 1,
    email_sent: 5,
    call_attempted: 3,
    engaged: 7,
    consultation_booked: 14,
    nurture_parked: 90,
  }),

  // --- AI settings (Phase 3) ---
  aiProviderPreference: llmProviderEnum("ai_provider_preference").notNull().default("groq"),
  // Injected into every AI prompt (research, email, call pitch) — replaces
  // the source system's hardcoded "Macktiles Australia is..." business
  // description. Sensible generic defaults ship out of the box; a new
  // client fills in their own via Admin -> AI Settings.
  brandContext: jsonb("brand_context").$type<AiBrandContext>().notNull().default({}),

  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AiBrandContext = {
  companyDescription?: string;
  valueProposition?: string;
  socialProof?: string;
  /** e.g. "Direct, practical, no exclamation marks" — injected as a style instruction, not hardcoded per-org tone rules. */
  toneGuidelines?: string;
};

// ---------------------------------------------------------------------------
// api_keys
//
// Encrypted at rest (AES-256-GCM, see lib/ai/key-encryption.ts) — the
// source system's own docs flagged plaintext key storage as a known issue;
// this fixes it. One row per provider per org.
// ---------------------------------------------------------------------------

export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    provider: llmProviderEnum("provider").notNull(),
    encryptedKey: text("encrypted_key").notNull(),
    // AES-GCM nonce, base64 — unique per encryption, must travel with the ciphertext.
    keyNonce: text("key_nonce").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("api_keys_org_id_provider_idx").on(table.orgId, table.provider)],
);

// ---------------------------------------------------------------------------
// aircall_settings
//
// One row per org (mirrors org_settings' shape) — Aircall API credentials
// and call-scoring config. Aircall needs three separate secrets (API id,
// API token, webhook token), each encrypted the same way api_keys encrypts
// its single LLM key (AES-256-GCM, see lib/ai/key-encryption.ts) — doesn't
// fit api_keys' one-secret-per-row shape, so it's its own table rather than
// forcing llmProviderEnum to grow non-LLM values.
// ---------------------------------------------------------------------------

export const aircallSettings = pgTable("aircall_settings", {
  orgId: uuid("org_id")
    .primaryKey()
    .references(() => organizations.id, { onDelete: "cascade" }),
  encryptedApiId: text("encrypted_api_id"),
  apiIdNonce: text("api_id_nonce"),
  encryptedApiToken: text("encrypted_api_token"),
  apiTokenNonce: text("api_token_nonce"),
  encryptedWebhookToken: text("encrypted_webhook_token"),
  webhookTokenNonce: text("webhook_token_nonce"),
  isEnabled: boolean("is_enabled").notNull().default(false),

  // --- AI call-scoring config ---
  scoringEnabled: boolean("scoring_enabled").notNull().default(false),
  scoringProvider: llmProviderEnum("scoring_provider").notNull().default("groq"),
  minCallDurationSeconds: integer("min_call_duration_seconds").notNull().default(60),
  minTranscriptConfidence: real("min_transcript_confidence").notNull().default(0.75),

  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// jobs
//
// Thin audit/status table the app owns for UI-facing job polling — separate
// from pg-boss's own internal queue tables, which this app never queries
// directly. One row per enqueued AI job (enrichment, email, call pitch).
// ---------------------------------------------------------------------------

export const jobRuns = pgTable(
  "job_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    type: jobTypeEnum("type").notNull(),
    status: jobStatusEnum("status").notNull().default("pending"),
    input: jsonb("input").$type<Record<string, unknown>>().notNull().default({}),
    resultId: uuid("result_id"), // points at the enrichment_results/email_history/call_pitches row once complete
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("job_runs_org_id_idx").on(table.orgId),
    index("job_runs_lead_id_idx").on(table.leadId),
  ],
);

// ---------------------------------------------------------------------------
// enrichment_results
//
// Structured research output — same shape as the source system's enrichment
// JSON (research_score/sources/company_profile/industry_intelligence/
// prospect_analysis/sales_strategy), stored as real columns instead of a
// stringified JSON blob on the lead row.
// ---------------------------------------------------------------------------

export const enrichmentResults = pgTable(
  "enrichment_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    jobRunId: uuid("job_run_id").references(() => jobRuns.id, { onDelete: "set null" }),
    researchScore: integer("research_score"),
    researchQuality: text("research_quality"),
    // research_score.factors from the AI response — was parsed and then
    // discarded at persistence time (no column existed), so the panel always
    // rendered an empty factors list regardless of what the model returned.
    researchFactors: jsonb("research_factors").$type<string[]>().notNull().default([]),
    sources: jsonb("sources").$type<Array<{ title: string; url: string; description: string }>>().notNull().default([]),
    companyProfile: jsonb("company_profile").$type<Record<string, unknown>>().notNull().default({}),
    industryIntelligence: jsonb("industry_intelligence").$type<Record<string, unknown>>().notNull().default({}),
    prospectAnalysis: jsonb("prospect_analysis").$type<Record<string, unknown>>().notNull().default({}),
    salesStrategy: jsonb("sales_strategy").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("enrichment_results_lead_id_idx").on(table.leadId)],
);

// ---------------------------------------------------------------------------
// email_history
// ---------------------------------------------------------------------------

export const emailHistory = pgTable(
  "email_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    jobRunId: uuid("job_run_id").references(() => jobRuns.id, { onDelete: "set null" }),
    sequenceStep: emailSequenceStepEnum("sequence_step").notNull(),
    // Groups a sequence's steps together for "reference the previous email" context.
    threadId: uuid("thread_id").notNull().defaultRandom(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    // Manually marked by the rep (no inbound-reply integration) — ports the
    // source system's email-outcome endpoint. replied/meeting_booked
    // auto-advance the lead's stage the same way a positive call outcome does.
    outcome: emailOutcomeEnum("outcome"),
    outcomeAt: timestamp("outcome_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("email_history_lead_id_idx").on(table.leadId)],
);

// ---------------------------------------------------------------------------
// call_pitches
// ---------------------------------------------------------------------------

export const callPitches = pgTable(
  "call_pitches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    jobRunId: uuid("job_run_id").references(() => jobRuns.id, { onDelete: "set null" }),
    pitchType: callPitchTypeEnum("pitch_type").notNull(),
    title: text("title").notNull(),
    script: text("script").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("call_pitches_lead_id_idx").on(table.leadId)],
);

// ---------------------------------------------------------------------------
// call_logs
//
// Manually-logged call outcomes (Phase 4) — replaces the source system's
// Aircall-driven call_history entirely; there's no dialer integration here,
// a rep logs the outcome themselves after making a call. Drives
// leads.callsMadeCount/lastCallOutcome (denormalized for scoring), the
// engagement score's call inputs, and the daily targets "calls done" count.
// ---------------------------------------------------------------------------

export const callLogs = pgTable(
  "call_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    loggedBy: uuid("logged_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Nullable — an Aircall-sourced row (via='aircall') is written by the
    // webhook the moment the call ends, before the rep has had a chance to
    // qualify the outcome; the manual "log an outcome" flow always sets
    // this immediately, so it's effectively required for via='manual' rows
    // even though the column itself can't express that conditional
    // not-null constraint.
    outcome: callOutcomeEnum("outcome"),
    // Step 4 of the source system's Outcome wizard — see nextActionEnum.
    // Nullable because a call log inserted before this field existed (or via
    // any other path) simply has no recorded next action.
    nextAction: nextActionEnum("next_action"),
    notes: text("notes"),

    // --- Aircall (optional) — populated only when via='aircall', written by
    // the webhook handler rather than a rep. A manually-logged call simply
    // leaves all of these null. ---
    via: callViaEnum("via").notNull().default("manual"),
    aircallCallId: text("aircall_call_id"),
    direction: callDirectionEnum("direction"),
    durationSeconds: integer("duration_seconds"),
    // S3 object key, not a URL — signed URLs are generated on read (same
    // pattern as chat attachments), since Aircall's own recording URLs
    // expire quickly and a stored public URL would go stale.
    recordingKey: text("recording_key"),
    transcriptStatus: transcriptStatusEnum("transcript_status"),
    transcript: text("transcript"),
    transcriptConfidence: real("transcript_confidence"),
    // Aircall's own AI-generated summary (Aircall AI Assist) — display-only
    // context, never fed into this app's own scoring pipeline.
    aiSummary: text("ai_summary"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("call_logs_org_id_idx").on(table.orgId),
    index("call_logs_lead_id_idx").on(table.leadId),
    index("call_logs_logged_by_idx").on(table.loggedBy),
    uniqueIndex("call_logs_aircall_call_id_idx").on(table.aircallCallId).where(sql`${table.aircallCallId} IS NOT NULL`),
  ],
);

export const callLogsRelations = relations(callLogs, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [callLogs.orgId],
    references: [organizations.id],
  }),
  lead: one(leads, {
    fields: [callLogs.leadId],
    references: [leads.id],
  }),
  loggedByUser: one(users, {
    fields: [callLogs.loggedBy],
    references: [users.id],
  }),
  score: many(callScores),
}));

// ---------------------------------------------------------------------------
// call_scores
//
// Output of the AI call-scoring pipeline (Aircall calls only) — ports the
// source system's call_scoring.php rubric exactly: 4 weighted sub-scores
// (execution/objectives/outcome/process) plus penalties, rolled into one
// final score and a 6-bucket classification. One row per scored call_logs
// entry, own table rather than a JSON blob on the lead (this app's
// relational pattern, matching enrichment_results/call_pitches).
// ---------------------------------------------------------------------------

export const callScores = pgTable(
  "call_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    callLogId: uuid("call_log_id")
      .notNull()
      .references(() => callLogs.id, { onDelete: "cascade" }),
    jobRunId: uuid("job_run_id").references(() => jobRuns.id, { onDelete: "set null" }),

    // False when the call didn't meet the eligibility gate (too short,
    // voicemail, transcript not ready, etc.) — every other field below is
    // null in that case, and ineligibleReason explains why.
    eligible: boolean("eligible").notNull(),
    ineligibleReason: text("ineligible_reason"),

    executionScore: real("execution_score"),
    executionBreakdown: jsonb("execution_breakdown").$type<Record<string, { score: number; reason: string; evidence: string }>>(),
    objectiveCompletionScore: real("objective_completion_score"),
    objectiveBreakdown: jsonb("objective_breakdown").$type<Array<{ objective: string; completed: boolean }>>(),
    outcomeScore: real("outcome_score"),
    outcomeBreakdown: jsonb("outcome_breakdown").$type<{ loggedOutcome: string; transcriptSupportsOutcome: boolean; note: string }>(),
    processScore: real("process_score"),
    processBreakdown: jsonb("process_breakdown").$type<{ notesQuality: string; followupTimingOk: boolean }>(),

    penalties: integer("penalties").notNull().default(0),
    penaltyReasons: jsonb("penalty_reasons").$type<string[]>().notNull().default([]),

    finalScore: real("final_score"),
    classification: callScoreClassificationEnum("classification"),
    confidence: real("confidence"),
    strengths: jsonb("strengths").$type<string[]>().notNull().default([]),
    coachingOpportunities: jsonb("coaching_opportunities").$type<string[]>().notNull().default([]),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("call_scores_call_log_id_idx").on(table.callLogId)],
);

export const callScoresRelations = relations(callScores, ({ one }) => ({
  callLog: one(callLogs, {
    fields: [callScores.callLogId],
    references: [callLogs.id],
  }),
}));

// ---------------------------------------------------------------------------
// lead_activity
//
// Deliberately generic (type + payload JSONB, nullable leadId) so a future
// chat/notifications system can reuse the same table shape rather than
// needing its own activity-log design.
// ---------------------------------------------------------------------------

export const leadActivityTypeEnum = pgEnum("lead_activity_type", [
  "created",
  "updated",
  "stage_changed",
  "imported",
  "deleted",
  "restored",
  "permanently_deleted",
  "enrichment_completed",
  "email_generated",
  "email_sent",
  "email_skipped",
  "call_pitch_generated",
  "call_started",
  "call_logged",
  "email_outcome_logged",
  "call_log_deleted",
]);

export const leadActivity = pgTable(
  "lead_activity",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    type: leadActivityTypeEnum("type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("lead_activity_lead_id_idx").on(table.leadId)],
);

// ---------------------------------------------------------------------------
// tickets / ticket_replies ("Feedback & Support")
//
// Ports the source system's support.php ticket channel as real relational
// tables instead of a single JSON blob in a KV store (getTicketsStore's
// ['tickets' => [...], 'seq' => ['ticket' => n]] shape) — replies get their
// own table (own createdAt, no manual array-append race), and ticketNo is a
// real per-org sequence instead of a counter baked into the same blob it
// numbers.
//
// Deliberately self-contained: the source system also forwarded every
// ticket/reply/status/delete to a central "Levata hub" over HTTP (admin.json
// ticket_hub_url/ticket_hub_secret) so central staff could reply from a
// separate system. That cross-deployment sync has no equivalent central
// system in this template yet and is left out — nothing here precludes
// adding an outbound webhook later without reshaping these tables.
//
// Open to every authenticated user (rep/admin/super_admin), not gated to
// super_admin like the source system's temporary requireSuperAdmin() —
// matches the intent stated in that file's own comment ("open up to all
// Macktiles staff/reps later"). A rep sees and manages only tickets they
// filed; admins/super_admins see and manage every ticket in the org.
// ---------------------------------------------------------------------------

export const ticketTypeEnum = pgEnum("ticket_type", ["feedback", "support"]);
export const ticketCategoryEnum = pgEnum("ticket_category", [
  // support
  "bug",
  "how_to",
  "account",
  "performance",
  // feedback
  "feature",
  "improvement",
  "complaint",
  "praise",
  // shared
  "other",
]);
export const ticketPriorityEnum = pgEnum("ticket_priority", ["low", "normal", "high"]);
export const ticketStatusEnum = pgEnum("ticket_status", ["open", "in_progress", "resolved", "closed"]);

export const SUPPORT_TICKET_CATEGORIES = ["bug", "how_to", "account", "performance", "other"] as const;
export const FEEDBACK_TICKET_CATEGORIES = ["feature", "improvement", "complaint", "praise", "other"] as const;

export const tickets = pgTable(
  "tickets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    // Sequential per org, e.g. TKT-0001 — assigned in the same transaction as
    // the insert (see lib/db/queries/tickets.ts) so two concurrent creates in
    // the same org can never collide on the same number.
    ticketNo: integer("ticket_no").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: ticketTypeEnum("type").notNull().default("support"),
    category: ticketCategoryEnum("category").notNull().default("other"),
    priority: ticketPriorityEnum("priority").notNull().default("normal"),
    status: ticketStatusEnum("status").notNull().default("open"),
    subject: text("subject").notNull(),
    message: text("message").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("tickets_org_id_idx").on(table.orgId),
    index("tickets_created_by_idx").on(table.createdBy),
    index("tickets_org_id_status_idx").on(table.orgId, table.status),
    uniqueIndex("tickets_org_id_ticket_no_idx").on(table.orgId, table.ticketNo),
  ],
);

export const ticketReplies = pgTable(
  "ticket_replies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    message: text("message").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("ticket_replies_ticket_id_idx").on(table.ticketId)],
);

export const ticketsRelations = relations(tickets, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [tickets.orgId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [tickets.createdBy],
    references: [users.id],
  }),
  replies: many(ticketReplies),
}));

export const ticketRepliesRelations = relations(ticketReplies, ({ one }) => ({
  ticket: one(tickets, {
    fields: [ticketReplies.ticketId],
    references: [tickets.id],
  }),
  author: one(users, {
    fields: [ticketReplies.authorId],
    references: [users.id],
  }),
}));

// ---------------------------------------------------------------------------
// notifications
//
// Per-rep proactive alerts (hot lead idle, callback due/overdue, going cold,
// stale research) generated by findAttentionNeeded-style checks and polled
// from the topbar. dedupeKey mirrors the source system's notif_key: a
// deterministic key per (check type, lead) so re-running generation never
// creates a duplicate for an issue that's already unread.
// ---------------------------------------------------------------------------

export const notificationTypeEnum = pgEnum("notification_type", [
  "hot_lead",
  "callback_due",
  "callback_overdue",
  "going_cold",
  "stale_research",
  "chat_mention",
  // Rep-facing nudge fired when an Aircall call ends — mirrors the source
  // system's log_call_outcome chat notification.
  "call_outcome_pending",
  // Feedback & Support: fired on a new reply or a status change on a ticket
  // the recipient cares about (the filer, or an admin/super_admin on any
  // open ticket) — see lib/db/queries/tickets.ts.
  "ticket_reply",
]);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "cascade" }),
    // Set only for chat_mention notifications — routes the bell's click-through
    // to the conversation instead of a lead detail page.
    chatConversationId: uuid("chat_conversation_id").references(() => chatConversations.id, { onDelete: "cascade" }),
    // Set only for ticket_reply notifications — routes the bell's click-through
    // to the ticket instead of a lead detail page.
    ticketId: uuid("ticket_id").references(() => tickets.id, { onDelete: "cascade" }),
    dedupeKey: text("dedupe_key").notNull(),
    type: notificationTypeEnum("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    isRead: boolean("is_read").notNull().default(false),
    // Dismiss ("Clear all" / the per-item X) used to hard-delete the row —
    // but generateAndSaveNotifications re-derives notifications from live
    // lead state on every poll, deduped only against dedupeKeys that still
    // exist in this table. Deleting the row erased that dedupe record too,
    // so the very next poll saw the underlying condition (still true) as
    // brand new and recreated the identical notification, unread — a
    // dismissed alert reappeared looking freshly generated. Soft-dismiss
    // instead: the row (and its dedupeKey) stays, so regeneration keeps
    // seeing it as already-handled; listNotifications just filters
    // dismissed rows out of what's shown.
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("notifications_user_id_idx").on(table.userId),
    uniqueIndex("notifications_user_dedupe_key_idx").on(table.userId, table.dedupeKey),
  ],
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const organizationsRelations = relations(organizations, ({ many, one }) => ({
  users: many(users),
  leads: many(leads),
  icpFields: many(icpFields),
  apiKeys: many(apiKeys),
  jobRuns: many(jobRuns),
  settings: one(orgSettings, {
    fields: [organizations.id],
    references: [orgSettings.orgId],
  }),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  organization: one(organizations, {
    fields: [apiKeys.orgId],
    references: [organizations.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  organization: one(organizations, {
    fields: [notifications.orgId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  lead: one(leads, {
    fields: [notifications.leadId],
    references: [leads.id],
  }),
  ticket: one(tickets, {
    fields: [notifications.ticketId],
    references: [tickets.id],
  }),
}));

export const jobRunsRelations = relations(jobRuns, ({ one }) => ({
  organization: one(organizations, {
    fields: [jobRuns.orgId],
    references: [organizations.id],
  }),
  lead: one(leads, {
    fields: [jobRuns.leadId],
    references: [leads.id],
  }),
  actor: one(users, {
    fields: [jobRuns.actorId],
    references: [users.id],
  }),
}));

export const enrichmentResultsRelations = relations(enrichmentResults, ({ one }) => ({
  organization: one(organizations, {
    fields: [enrichmentResults.orgId],
    references: [organizations.id],
  }),
  lead: one(leads, {
    fields: [enrichmentResults.leadId],
    references: [leads.id],
  }),
}));

export const emailHistoryRelations = relations(emailHistory, ({ one }) => ({
  organization: one(organizations, {
    fields: [emailHistory.orgId],
    references: [organizations.id],
  }),
  lead: one(leads, {
    fields: [emailHistory.leadId],
    references: [leads.id],
  }),
}));

export const callPitchesRelations = relations(callPitches, ({ one }) => ({
  organization: one(organizations, {
    fields: [callPitches.orgId],
    references: [organizations.id],
  }),
  lead: one(leads, {
    fields: [callPitches.leadId],
    references: [leads.id],
  }),
}));

export const icpFieldsRelations = relations(icpFields, ({ one }) => ({
  organization: one(organizations, {
    fields: [icpFields.orgId],
    references: [organizations.id],
  }),
}));

export const orgSettingsRelations = relations(orgSettings, ({ one }) => ({
  organization: one(organizations, {
    fields: [orgSettings.orgId],
    references: [organizations.id],
  }),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [users.orgId],
    references: [organizations.id],
  }),
  sessions: many(sessions),
  ownedLeads: many(leads),
  senderProfile: one(userSenderProfiles, {
    fields: [users.id],
    references: [userSenderProfiles.userId],
  }),
}));

export const userSenderProfilesRelations = relations(userSenderProfiles, ({ one }) => ({
  user: one(users, {
    fields: [userSenderProfiles.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [userSenderProfiles.orgId],
    references: [organizations.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
  impersonator: one(users, {
    fields: [sessions.impersonatedBy],
    references: [users.id],
  }),
}));

// ---------------------------------------------------------------------------
// activity_pings
//
// One row per activity-ping heartbeat (see api/activity-ping) — the actual
// history the source system's user-sessions admin view is built from:
// consecutive pings less than 30 minutes apart are grouped client-side into
// one logical "session" with a real duration and page list, rather than
// treating each login/cookie session as a session in its own right. Ports
// the source system's ping log (dbLoadPings) exactly; `sessions.lastSeenAt`/
// `lastPage` remain a cheap last-known cache for the "online now" dot, but
// this table is the source of truth for session grouping and active-minutes.
// ---------------------------------------------------------------------------

export const activityPings = pgTable(
  "activity_pings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    page: text("page"),
    pingedAt: timestamp("pinged_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("activity_pings_user_id_pinged_at_idx").on(table.userId, table.pingedAt)],
);

export const activityPingsRelations = relations(activityPings, ({ one }) => ({
  user: one(users, {
    fields: [activityPings.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [activityPings.orgId],
    references: [organizations.id],
  }),
}));

// ---------------------------------------------------------------------------
// aircall_on_call
//
// "Who's on a call right now" — genuinely ephemeral, unlike everything else
// in this schema. Ports the source system's kvGet/kvSet('aircall','oncall')
// KV entries as real rows instead (this app has no generic KV store): one
// row per live call, written on call.created, deleted on call.hungup/ended,
// and pruned if stale (>4h, matching the source system's own staleness
// guard for calls that never got a hangup event). Polled by an API route
// rather than pushed over a websocket — this app's only live-push channel is
// the chat-specific service, and building a second one just for this single
// admin-only widget isn't worth the extra infrastructure.
// ---------------------------------------------------------------------------

export const aircallOnCall = pgTable("aircall_on_call", {
  // Aircall's own call id doubles as the primary key — one row per live call.
  aircallCallId: text("aircall_call_id").primaryKey(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  userName: text("user_name").notNull(),
  phone: text("phone"),
  direction: callDirectionEnum("direction"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
});

export const leadsRelations = relations(leads, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [leads.orgId],
    references: [organizations.id],
  }),
  owner: one(users, {
    fields: [leads.ownerId],
    references: [users.id],
  }),
  activity: many(leadActivity),
  jobRuns: many(jobRuns),
  enrichmentResults: many(enrichmentResults),
  emailHistory: many(emailHistory),
  callPitches: many(callPitches),
  callLogs: many(callLogs),
}));

export const leadActivityRelations = relations(leadActivity, ({ one }) => ({
  organization: one(organizations, {
    fields: [leadActivity.orgId],
    references: [organizations.id],
  }),
  lead: one(leads, {
    fields: [leadActivity.leadId],
    references: [leads.id],
  }),
  actor: one(users, {
    fields: [leadActivity.actorId],
    references: [users.id],
  }),
}));

// ---------------------------------------------------------------------------
// daily_targets
//
// Numeric daily quotas (calls/emails/research/outcomes). One org-wide
// default row (userId null) plus optional per-rep override rows — mirrors
// the source system's fallback chain (rep override -> org default ->
// hardcoded fallback) but as real rows instead of a JSON blob buried in a
// per-user settings key, so it can be queried/joined normally.
// ---------------------------------------------------------------------------

export const dailyTargets = pgTable(
  "daily_targets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    // Null = org-wide default row. Non-null = one rep's personal override.
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    callsTarget: integer("calls_target").notNull().default(40),
    emailsTarget: integer("emails_target").notNull().default(40),
    researchTarget: integer("research_target").notNull().default(25),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Postgres treats NULL as distinct in a plain unique index, so a bare
    // UNIQUE(org_id, user_id) would NOT stop two org-default (user_id NULL)
    // rows from coexisting. Two partial indexes instead: one enforcing at
    // most one personal-override row per rep, one enforcing at most one
    // org-default row per org.
    uniqueIndex("daily_targets_org_id_user_id_idx")
      .on(table.orgId, table.userId)
      .where(sql`${table.userId} IS NOT NULL`),
    uniqueIndex("daily_targets_org_id_default_idx")
      .on(table.orgId)
      .where(sql`${table.userId} IS NULL`),
    index("daily_targets_org_id_idx").on(table.orgId),
  ],
);

export const DEFAULT_DAILY_TARGETS = { callsTarget: 40, emailsTarget: 40, researchTarget: 25 };

// ---------------------------------------------------------------------------
// daily_commitments
//
// Ad-hoc to-do items for today (e.g. "call this lead by 2pm"), separate
// from the numeric targets above — manually checked off, unlike the
// activity-derived numeric progress. Incomplete items surface as
// "carried over" once their date is in the past (see queries/daily.ts).
// ---------------------------------------------------------------------------

export const dailyCommitments = pgTable(
  "daily_commitments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    // The calendar date (rep's local "today" at creation time) this commitment was made for.
    forDate: text("for_date").notNull(),
    // Task type — matches the source system's "action" field (call/email/research/other).
    action: dailyCommitmentActionEnum("action").notNull().default("other"),
    dueTime: text("due_time"),
    description: text("description").notNull(),
    isCompleted: boolean("is_completed").notNull().default(false),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("daily_commitments_org_id_user_id_idx").on(table.orgId, table.userId),
    index("daily_commitments_for_date_idx").on(table.forDate),
  ],
);

// ---------------------------------------------------------------------------
// daily_performance
//
// One snapshot per rep per day, saved when the rep views/closes out their
// Commitments page — powers the streak badge without recomputing history
// from lead_activity/email_history on every load.
// ---------------------------------------------------------------------------

export const dailyPerformance = pgTable(
  "daily_performance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    forDate: text("for_date").notNull(),
    callsDone: integer("calls_done").notNull().default(0),
    callsTarget: integer("calls_target").notNull().default(0),
    emailsDone: integer("emails_done").notNull().default(0),
    emailsTarget: integer("emails_target").notNull().default(0),
    researchDone: integer("research_done").notNull().default(0),
    researchTarget: integer("research_target").notNull().default(0),
    // Target met on this day iff all three *_done >= *_target — used for streak counting.
    targetMet: boolean("target_met").notNull().default(false),
    savedAt: timestamp("saved_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("daily_performance_org_id_user_id_for_date_idx").on(table.orgId, table.userId, table.forDate)],
);

export const dailyTargetsRelations = relations(dailyTargets, ({ one }) => ({
  organization: one(organizations, {
    fields: [dailyTargets.orgId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [dailyTargets.userId],
    references: [users.id],
  }),
}));

export const dailyCommitmentsRelations = relations(dailyCommitments, ({ one }) => ({
  organization: one(organizations, {
    fields: [dailyCommitments.orgId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [dailyCommitments.userId],
    references: [users.id],
  }),
  lead: one(leads, {
    fields: [dailyCommitments.leadId],
    references: [leads.id],
  }),
}));

export const dailyPerformanceRelations = relations(dailyPerformance, ({ one }) => ({
  organization: one(organizations, {
    fields: [dailyPerformance.orgId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [dailyPerformance.userId],
    references: [users.id],
  }),
}));

// ---------------------------------------------------------------------------
// Team Chat
//
// A conversation is either a named channel or a 1:1 DM — one table with a
// `kind` discriminator, not the source system's string-prefixed thread id
// (`"dm_" . md5(...)` vs `"channel_..."` parsed back apart on every request).
// Membership, reactions, and read state are all normal rows in their own
// tables rather than JSON blobs on a message/thread record, so two people
// acting on the same conversation at once (reacting while a third person
// sends) are just two independent row writes — nothing to race or clobber.
// ---------------------------------------------------------------------------

export const chatConversationKindEnum = pgEnum("chat_conversation_kind", ["channel", "dm"]);

export const chatConversations = pgTable(
  "chat_conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    kind: chatConversationKindEnum("kind").notNull(),
    // Channels only — null for DMs. Slug-cased, unique per org.
    name: text("name"),
    description: text("description"),
    // Null members = public channel, visible/joinable by the whole org.
    // Non-null (via chat_channel_members rows) = private, invite-only.
    isPrivate: boolean("is_private").notNull().default(false),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("chat_conversations_org_id_idx").on(table.orgId),
    uniqueIndex("chat_conversations_org_id_name_idx").on(table.orgId, table.name),
  ],
);

// DM participants AND private-channel membership both live here — a DM is
// just a 2-row-membership conversation, so "who can see this conversation"
// is always one uniform query regardless of kind.
export const chatConversationMembers = pgTable(
  "chat_conversation_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => chatConversations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Per-member last-read watermark — powers unread counts without a
    // separate KV table (dbGetLastRead/dbSetLastRead in the source system).
    lastReadAt: timestamp("last_read_at", { withTimezone: true }),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("chat_conversation_members_conversation_id_user_id_idx").on(table.conversationId, table.userId),
    index("chat_conversation_members_user_id_idx").on(table.userId),
  ],
);

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => chatConversations.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    // Optional single attachment. attachmentKey is the S3/MinIO object key
    // (never a public URL — rendered via a short-lived signed URL so the
    // bucket itself can stay private).
    attachmentKey: text("attachment_key"),
    attachmentName: text("attachment_name"),
    attachmentType: text("attachment_type"),
    attachmentSize: integer("attachment_size"),
    // Null for a top-level message. Points at the message this one replies
    // to, always within the same conversation — one level deep (a reply to a
    // reply still points at the original root), matching Slack/Linear-style
    // flat threads rather than arbitrarily nested ones.
    replyToId: uuid("reply_to_id").references((): AnyPgColumn => chatMessages.id, { onDelete: "set null" }),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    // Soft-delete: keeps the row (and any reactions/pin pointing at it) so a
    // deleted message renders as a tombstone in place, not a hole that shifts
    // every reaction/pin lookup around it.
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    pinnedAt: timestamp("pinned_at", { withTimezone: true }),
    pinnedBy: uuid("pinned_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("chat_messages_conversation_id_created_at_idx").on(table.conversationId, table.createdAt),
    index("chat_messages_conversation_id_pinned_at_idx").on(table.conversationId, table.pinnedAt),
    index("chat_messages_reply_to_id_idx").on(table.replyToId),
  ],
);

export const chatMessageReactions = pgTable(
  "chat_message_reactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => chatMessages.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("chat_message_reactions_message_id_user_id_emoji_idx").on(table.messageId, table.userId, table.emoji)],
);

export const chatConversationsRelations = relations(chatConversations, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [chatConversations.orgId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [chatConversations.createdBy],
    references: [users.id],
  }),
  members: many(chatConversationMembers),
  messages: many(chatMessages),
}));

export const chatConversationMembersRelations = relations(chatConversationMembers, ({ one }) => ({
  conversation: one(chatConversations, {
    fields: [chatConversationMembers.conversationId],
    references: [chatConversations.id],
  }),
  user: one(users, {
    fields: [chatConversationMembers.userId],
    references: [users.id],
  }),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one, many }) => ({
  conversation: one(chatConversations, {
    fields: [chatMessages.conversationId],
    references: [chatConversations.id],
  }),
  sender: one(users, {
    fields: [chatMessages.senderId],
    references: [users.id],
  }),
  pinner: one(users, {
    fields: [chatMessages.pinnedBy],
    references: [users.id],
  }),
  replyTo: one(chatMessages, {
    fields: [chatMessages.replyToId],
    references: [chatMessages.id],
    relationName: "chatMessageReplies",
  }),
  replies: many(chatMessages, { relationName: "chatMessageReplies" }),
  reactions: many(chatMessageReactions),
}));

export const chatMessageReactionsRelations = relations(chatMessageReactions, ({ one }) => ({
  message: one(chatMessages, {
    fields: [chatMessageReactions.messageId],
    references: [chatMessages.id],
  }),
  user: one(users, {
    fields: [chatMessageReactions.userId],
    references: [users.id],
  }),
}));
