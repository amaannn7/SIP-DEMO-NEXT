CREATE TYPE "public"."email_outcome" AS ENUM('replied', 'bounced', 'no_response', 'meeting_booked');--> statement-breakpoint
ALTER TABLE "email_history" ADD COLUMN "outcome" "email_outcome";--> statement-breakpoint
ALTER TABLE "email_history" ADD COLUMN "outcome_at" timestamp with time zone;