CREATE TYPE "public"."email_skip_reason" AS ENUM('already_contacted', 'phone_preferred', 'referral', 'other');--> statement-breakpoint
ALTER TYPE "public"."lead_activity_type" ADD VALUE 'email_skipped' BEFORE 'call_pitch_generated';--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "email_skipped" "email_skip_reason";