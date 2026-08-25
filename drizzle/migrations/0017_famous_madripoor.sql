ALTER TABLE "chat_messages" ADD COLUMN "attachment_key" text;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "attachment_name" text;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "attachment_type" text;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "attachment_size" integer;