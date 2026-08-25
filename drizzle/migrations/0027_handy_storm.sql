CREATE TYPE "public"."call_direction" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TYPE "public"."call_score_classification" AS ENUM('correctly_disqualified', 'effective_call', 'well_handled_no_immediate_progress', 'positive_result_execution_risk', 'ineffective_call', 'mixed_result');--> statement-breakpoint
CREATE TYPE "public"."call_via" AS ENUM('manual', 'aircall');--> statement-breakpoint
CREATE TYPE "public"."transcript_status" AS ENUM('pending', 'ready', 'failed', 'skipped');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'call_outcome_pending';--> statement-breakpoint
CREATE TABLE "aircall_on_call" (
	"aircall_call_id" text PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid,
	"user_name" text NOT NULL,
	"phone" text,
	"direction" "call_direction",
	"started_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aircall_settings" (
	"org_id" uuid PRIMARY KEY NOT NULL,
	"encrypted_api_id" text,
	"api_id_nonce" text,
	"encrypted_api_token" text,
	"api_token_nonce" text,
	"encrypted_webhook_token" text,
	"webhook_token_nonce" text,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"scoring_enabled" boolean DEFAULT false NOT NULL,
	"scoring_provider" "llm_provider" DEFAULT 'groq' NOT NULL,
	"min_call_duration_seconds" integer DEFAULT 60 NOT NULL,
	"min_transcript_confidence" real DEFAULT 0.75 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "call_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"call_log_id" uuid NOT NULL,
	"job_run_id" uuid,
	"eligible" boolean NOT NULL,
	"ineligible_reason" text,
	"execution_score" real,
	"execution_breakdown" jsonb,
	"objective_completion_score" real,
	"objective_breakdown" jsonb,
	"outcome_score" real,
	"outcome_breakdown" jsonb,
	"process_score" real,
	"process_breakdown" jsonb,
	"penalties" integer DEFAULT 0 NOT NULL,
	"penalty_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"final_score" real,
	"classification" "call_score_classification",
	"confidence" real,
	"strengths" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"coaching_opportunities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "call_logs" ADD COLUMN "via" "call_via" DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "call_logs" ADD COLUMN "aircall_call_id" text;--> statement-breakpoint
ALTER TABLE "call_logs" ADD COLUMN "direction" "call_direction";--> statement-breakpoint
ALTER TABLE "call_logs" ADD COLUMN "duration_seconds" integer;--> statement-breakpoint
ALTER TABLE "call_logs" ADD COLUMN "recording_key" text;--> statement-breakpoint
ALTER TABLE "call_logs" ADD COLUMN "transcript_status" "transcript_status";--> statement-breakpoint
ALTER TABLE "call_logs" ADD COLUMN "transcript" text;--> statement-breakpoint
ALTER TABLE "call_logs" ADD COLUMN "transcript_confidence" real;--> statement-breakpoint
ALTER TABLE "call_logs" ADD COLUMN "ai_summary" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "aircall_user_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "aircall_number_id" text;--> statement-breakpoint
ALTER TABLE "aircall_on_call" ADD CONSTRAINT "aircall_on_call_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aircall_on_call" ADD CONSTRAINT "aircall_on_call_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aircall_settings" ADD CONSTRAINT "aircall_settings_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_scores" ADD CONSTRAINT "call_scores_call_log_id_call_logs_id_fk" FOREIGN KEY ("call_log_id") REFERENCES "public"."call_logs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_scores" ADD CONSTRAINT "call_scores_job_run_id_job_runs_id_fk" FOREIGN KEY ("job_run_id") REFERENCES "public"."job_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "call_scores_call_log_id_idx" ON "call_scores" USING btree ("call_log_id");--> statement-breakpoint
CREATE UNIQUE INDEX "call_logs_aircall_call_id_idx" ON "call_logs" USING btree ("aircall_call_id") WHERE "call_logs"."aircall_call_id" IS NOT NULL;