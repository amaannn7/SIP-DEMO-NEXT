DROP INDEX "daily_targets_org_id_user_id_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "daily_targets_org_id_default_idx" ON "daily_targets" USING btree ("org_id") WHERE "daily_targets"."user_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "daily_targets_org_id_user_id_idx" ON "daily_targets" USING btree ("org_id","user_id") WHERE "daily_targets"."user_id" IS NOT NULL;