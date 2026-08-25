CREATE TYPE "public"."lead_activity_type" AS ENUM('created', 'updated', 'stage_changed', 'imported', 'deleted', 'restored');--> statement-breakpoint
CREATE TYPE "public"."lead_source" AS ENUM('import', 'inbound', 'manual', 'other');--> statement-breakpoint
CREATE TYPE "public"."lead_stage" AS ENUM('new_lead', 'research', 'email_sent', 'call_attempted', 'engaged', 'consultation_booked', 'nurture_parked', 'won', 'lost');--> statement-breakpoint
CREATE TABLE "lead_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"lead_id" uuid,
	"actor_id" uuid,
	"type" "lead_activity_type" NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"owner_id" uuid,
	"first_name" text DEFAULT '' NOT NULL,
	"last_name" text DEFAULT '' NOT NULL,
	"email" text,
	"phone" text,
	"company" text,
	"title" text,
	"industry" text,
	"country" text,
	"website" text,
	"linkedin" text,
	"company_size" text,
	"notes" text,
	"stage" "lead_stage" DEFAULT 'new_lead' NOT NULL,
	"source" "lead_source" DEFAULT 'manual' NOT NULL,
	"source_detail" text,
	"zoho_record_id" text,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lead_activity" ADD CONSTRAINT "lead_activity_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_activity" ADD CONSTRAINT "lead_activity_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_activity" ADD CONSTRAINT "lead_activity_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lead_activity_lead_id_idx" ON "lead_activity" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "leads_org_id_idx" ON "leads" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "leads_owner_id_idx" ON "leads" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "leads_stage_idx" ON "leads" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "leads_org_id_email_idx" ON "leads" USING btree ("org_id","email");--> statement-breakpoint
CREATE INDEX "leads_org_id_zoho_record_id_idx" ON "leads" USING btree ("org_id","zoho_record_id");