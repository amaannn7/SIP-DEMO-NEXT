ALTER TYPE "public"."job_type" ADD VALUE 'score_call';--> statement-breakpoint
ALTER TABLE "call_logs" ALTER COLUMN "outcome" DROP NOT NULL;