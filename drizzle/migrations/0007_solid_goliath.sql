CREATE TYPE "public"."daily_commitment_action" AS ENUM('call', 'email', 'research', 'other');--> statement-breakpoint
ALTER TABLE "daily_commitments" ADD COLUMN "action" "daily_commitment_action" DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_commitments" ADD COLUMN "due_time" text;