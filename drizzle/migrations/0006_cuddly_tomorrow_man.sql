CREATE TYPE "public"."email_tone" AS ENUM('professional', 'casual', 'friendly');--> statement-breakpoint
CREATE TABLE "user_sender_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"org_id" uuid NOT NULL,
	"sender_name" text,
	"sender_title" text,
	"sender_company" text,
	"calendar_link" text,
	"email_tone" "email_tone",
	"company_description" text,
	"value_proposition" text,
	"social_proof" text,
	"signature" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_sender_profiles" ADD CONSTRAINT "user_sender_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sender_profiles" ADD CONSTRAINT "user_sender_profiles_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;