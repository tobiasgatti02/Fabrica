ALTER TABLE "studio_projects" ADD COLUMN "share_enabled" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "studio_projects" ADD COLUMN "share_expires" bigint DEFAULT 0 NOT NULL;