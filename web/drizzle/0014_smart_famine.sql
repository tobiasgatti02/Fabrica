CREATE TABLE "studio_worktables" (
	"id" text PRIMARY KEY NOT NULL,
	"project" text NOT NULL,
	"title" text NOT NULL,
	"template" text DEFAULT 'blank' NOT NULL,
	"created" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "studio_inspiration" ADD COLUMN "worktable" text;--> statement-breakpoint
ALTER TABLE "studio_worktables" ADD CONSTRAINT "studio_worktables_project_studio_projects_id_fk" FOREIGN KEY ("project") REFERENCES "public"."studio_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "studio_worktables_project" ON "studio_worktables" USING btree ("project");--> statement-breakpoint
ALTER TABLE "studio_inspiration" ADD CONSTRAINT "studio_inspiration_worktable_studio_worktables_id_fk" FOREIGN KEY ("worktable") REFERENCES "public"."studio_worktables"("id") ON DELETE no action ON UPDATE no action;