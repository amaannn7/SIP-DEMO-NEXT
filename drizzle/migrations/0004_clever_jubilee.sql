CREATE TYPE "public"."call_outcome" AS ENUM('no_answer_retry', 'left_voicemail', 'gatekeeper', 'wrong_number', 'not_interested', 'interested_followup', 'consultation_booked', 'callback_requested', 'not_right_time_park_90');--> statement-breakpoint
ALTER TYPE "public"."lead_activity_type" ADD VALUE 'call_logged';--> statement-breakpoint
CREATE TABLE "call_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"lead_id" uuid NOT NULL,
	"logged_by" uuid NOT NULL,
	"outcome" "call_outcome" NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_commitments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"lead_id" uuid,
	"for_date" text NOT NULL,
	"description" text NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_performance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"for_date" text NOT NULL,
	"calls_done" integer DEFAULT 0 NOT NULL,
	"calls_target" integer DEFAULT 0 NOT NULL,
	"emails_done" integer DEFAULT 0 NOT NULL,
	"emails_target" integer DEFAULT 0 NOT NULL,
	"research_done" integer DEFAULT 0 NOT NULL,
	"research_target" integer DEFAULT 0 NOT NULL,
	"target_met" boolean DEFAULT false NOT NULL,
	"saved_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid,
	"calls_target" integer DEFAULT 40 NOT NULL,
	"emails_target" integer DEFAULT 40 NOT NULL,
	"research_target" integer DEFAULT 25 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "calls_made_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "last_call_outcome" "call_outcome";--> statement-breakpoint
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_logged_by_users_id_fk" FOREIGN KEY ("logged_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_commitments" ADD CONSTRAINT "daily_commitments_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_commitments" ADD CONSTRAINT "daily_commitments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_commitments" ADD CONSTRAINT "daily_commitments_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_performance" ADD CONSTRAINT "daily_performance_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_performance" ADD CONSTRAINT "daily_performance_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_targets" ADD CONSTRAINT "daily_targets_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_targets" ADD CONSTRAINT "daily_targets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "call_logs_org_id_idx" ON "call_logs" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "call_logs_lead_id_idx" ON "call_logs" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "call_logs_logged_by_idx" ON "call_logs" USING btree ("logged_by");--> statement-breakpoint
CREATE INDEX "daily_commitments_org_id_user_id_idx" ON "daily_commitments" USING btree ("org_id","user_id");--> statement-breakpoint
CREATE INDEX "daily_commitments_for_date_idx" ON "daily_commitments" USING btree ("for_date");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_performance_org_id_user_id_for_date_idx" ON "daily_performance" USING btree ("org_id","user_id","for_date");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_targets_org_id_user_id_idx" ON "daily_targets" USING btree ("org_id","user_id");--> statement-breakpoint
CREATE INDEX "daily_targets_org_id_idx" ON "daily_targets" USING btree ("org_id");