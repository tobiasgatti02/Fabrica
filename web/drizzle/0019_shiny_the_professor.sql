ALTER TABLE "studio_inspiration_comments" ALTER COLUMN "inspiration" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "studio_inspiration_comments" ADD COLUMN IF NOT EXISTS "element" text;--> statement-breakpoint
ALTER TABLE "studio_inspiration_comments" ADD COLUMN IF NOT EXISTS "worktable" text;
