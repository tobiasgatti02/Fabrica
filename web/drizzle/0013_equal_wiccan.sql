ALTER TABLE "studio_tasks" ADD COLUMN "start_date" text;--> statement-breakpoint
ALTER TABLE "studio_tasks" ADD COLUMN "client_visible" integer DEFAULT 0 NOT NULL;