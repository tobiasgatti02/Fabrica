CREATE TABLE "studio_inspiration_comments" (
	"id" text PRIMARY KEY NOT NULL,
	"project" text NOT NULL,
	"inspiration" text NOT NULL,
	"author" text NOT NULL,
	"text" text NOT NULL,
	"created" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "studio_inspiration_comments" ADD CONSTRAINT "studio_inspiration_comments_project_studio_projects_id_fk" FOREIGN KEY ("project") REFERENCES "public"."studio_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio_inspiration_comments" ADD CONSTRAINT "studio_inspiration_comments_inspiration_studio_inspiration_id_fk" FOREIGN KEY ("inspiration") REFERENCES "public"."studio_inspiration"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "studio_inspiration_comments_project" ON "studio_inspiration_comments" USING btree ("project");--> statement-breakpoint
CREATE INDEX "studio_inspiration_comments_inspiration" ON "studio_inspiration_comments" USING btree ("inspiration");