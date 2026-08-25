CREATE TYPE "public"."icp_field_type" AS ENUM('text', 'number', 'boolean', 'select', 'multiselect');--> statement-breakpoint
CREATE TYPE "public"."lead_fit_grade" AS ENUM('A', 'B', 'C', 'Disqualified', 'Unscored');--> statement-breakpoint
CREATE TYPE "public"."lead_temperature" AS ENUM('on_fire', 'hot', 'warm', 'cold');--> statement-breakpoint
CREATE TYPE "public"."lead_velocity" AS ENUM('accelerating', 'stable', 'slowing', 'stalled');--> statement-breakpoint
CREATE TABLE "icp_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"field_type" "icp_field_type" DEFAULT 'select' NOT NULL,
	"options" jsonb,
	"weight" integer DEFAULT 0 NOT NULL,
	"is_required" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_settings" (
	"org_id" uuid PRIMARY KEY NOT NULL,
	"fit_grade_a_threshold" integer DEFAULT 80 NOT NULL,
	"fit_grade_b_threshold" integer DEFAULT 60 NOT NULL,
	"fit_grade_c_threshold" integer DEFAULT 40 NOT NULL,
	"sla_max_days_by_stage" jsonb DEFAULT '{"new_lead":1,"research":1,"email_sent":5,"call_attempted":3,"engaged":7,"consultation_booked":14,"nurture_parked":90}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "fit_score" integer;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "fit_grade" "lead_fit_grade";--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "fit_factors" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "fit_disqualifiers" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "engagement_score" integer;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "temperature" "lead_temperature";--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "velocity" "lead_velocity";--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "scores_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "followup_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "skipped_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "last_activity_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "icp_fields" ADD CONSTRAINT "icp_fields_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_settings" ADD CONSTRAINT "org_settings_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "icp_fields_org_id_key_idx" ON "icp_fields" USING btree ("org_id","key");--> statement-breakpoint
CREATE INDEX "icp_fields_org_id_idx" ON "icp_fields" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "leads_temperature_idx" ON "leads" USING btree ("temperature");