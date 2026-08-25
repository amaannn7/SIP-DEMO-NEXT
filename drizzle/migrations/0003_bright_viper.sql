CREATE TYPE "public"."call_pitch_type" AS ENUM('cold_with_email', 'cold_no_email', 'callback', 'discovery', 'demo');--> statement-breakpoint
CREATE TYPE "public"."email_sequence_step" AS ENUM('initial', 'followup1', 'followup2', 'breakup');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."job_type" AS ENUM('enrich_lead', 'generate_email', 'generate_call_pitch');--> statement-breakpoint
CREATE TYPE "public"."llm_provider" AS ENUM('groq', 'gemini', 'anthropic', 'cerebras');--> statement-breakpoint
ALTER TYPE "public"."lead_activity_type" ADD VALUE 'enrichment_completed';--> statement-breakpoint
ALTER TYPE "public"."lead_activity_type" ADD VALUE 'email_generated';--> statement-breakpoint
ALTER TYPE "public"."lead_activity_type" ADD VALUE 'call_pitch_generated';--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"provider" "llm_provider" NOT NULL,
	"encrypted_key" text NOT NULL,
	"key_nonce" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "call_pitches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"job_run_id" uuid,
	"pitch_type" "call_pitch_type" NOT NULL,
	"title" text NOT NULL,
	"script" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"job_run_id" uuid,
	"sequence_step" "email_sequence_step" NOT NULL,
	"thread_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enrichment_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"job_run_id" uuid,
	"research_score" integer,
	"research_quality" text,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"company_profile" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"industry_intelligence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"prospect_analysis" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sales_strategy" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"lead_id" uuid,
	"actor_id" uuid,
	"type" "job_type" NOT NULL,
	"status" "job_status" DEFAULT 'pending' NOT NULL,
	"input" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result_id" uuid,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "has_enrichment" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "emails_sent_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "last_email_step" "email_sequence_step";--> statement-breakpoint
ALTER TABLE "org_settings" ADD COLUMN "ai_provider_preference" "llm_provider" DEFAULT 'groq' NOT NULL;--> statement-breakpoint
ALTER TABLE "org_settings" ADD COLUMN "brand_context" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_pitches" ADD CONSTRAINT "call_pitches_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_pitches" ADD CONSTRAINT "call_pitches_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_pitches" ADD CONSTRAINT "call_pitches_job_run_id_job_runs_id_fk" FOREIGN KEY ("job_run_id") REFERENCES "public"."job_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_history" ADD CONSTRAINT "email_history_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_history" ADD CONSTRAINT "email_history_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_history" ADD CONSTRAINT "email_history_job_run_id_job_runs_id_fk" FOREIGN KEY ("job_run_id") REFERENCES "public"."job_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrichment_results" ADD CONSTRAINT "enrichment_results_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrichment_results" ADD CONSTRAINT "enrichment_results_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrichment_results" ADD CONSTRAINT "enrichment_results_job_run_id_job_runs_id_fk" FOREIGN KEY ("job_run_id") REFERENCES "public"."job_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_runs" ADD CONSTRAINT "job_runs_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_runs" ADD CONSTRAINT "job_runs_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_runs" ADD CONSTRAINT "job_runs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "api_keys_org_id_provider_idx" ON "api_keys" USING btree ("org_id","provider");--> statement-breakpoint
CREATE INDEX "call_pitches_lead_id_idx" ON "call_pitches" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "email_history_lead_id_idx" ON "email_history" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "enrichment_results_lead_id_idx" ON "enrichment_results" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "job_runs_org_id_idx" ON "job_runs" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "job_runs_lead_id_idx" ON "job_runs" USING btree ("lead_id");