ALTER TYPE "public"."lead_activity_type" ADD VALUE 'permanently_deleted' BEFORE 'enrichment_completed';--> statement-breakpoint
ALTER TYPE "public"."lead_activity_type" ADD VALUE 'email_outcome_logged';--> statement-breakpoint
ALTER TYPE "public"."lead_activity_type" ADD VALUE 'call_log_deleted';