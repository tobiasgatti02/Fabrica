ALTER TABLE "studio_users" ALTER COLUMN "password_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "studio_users" ADD COLUMN "google_subject" text;--> statement-breakpoint
CREATE UNIQUE INDEX "studio_users_google_subject_unique" ON "studio_users" USING btree ("google_subject");