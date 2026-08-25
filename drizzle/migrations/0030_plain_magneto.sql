CREATE TYPE "public"."ticket_category" AS ENUM('bug', 'how_to', 'account', 'performance', 'feature', 'improvement', 'complaint', 'praise', 'other');--> statement-breakpoint
CREATE TYPE "public"."ticket_priority" AS ENUM('low', 'normal', 'high');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('open', 'in_progress', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."ticket_type" AS ENUM('feedback', 'support');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'ticket_reply';--> statement-breakpoint
CREATE TABLE "ticket_replies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"ticket_no" integer NOT NULL,
	"created_by" uuid NOT NULL,
	"type" "ticket_type" DEFAULT 'support' NOT NULL,
	"category" "ticket_category" DEFAULT 'other' NOT NULL,
	"priority" "ticket_priority" DEFAULT 'normal' NOT NULL,
	"status" "ticket_status" DEFAULT 'open' NOT NULL,
	"subject" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "ticket_id" uuid;--> statement-breakpoint
ALTER TABLE "ticket_replies" ADD CONSTRAINT "ticket_replies_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_replies" ADD CONSTRAINT "ticket_replies_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ticket_replies_ticket_id_idx" ON "ticket_replies" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "tickets_org_id_idx" ON "tickets" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "tickets_created_by_idx" ON "tickets" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "tickets_org_id_status_idx" ON "tickets" USING btree ("org_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "tickets_org_id_ticket_no_idx" ON "tickets" USING btree ("org_id","ticket_no");--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;