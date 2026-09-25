CREATE TABLE "studio_inspiration_reactions" (
	"id" text PRIMARY KEY NOT NULL,
	"project" text NOT NULL,
	"inspiration" text NOT NULL,
	"actor" text NOT NULL,
	"emoji" text NOT NULL,
	"created" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "studio_inspiration_reactions" ADD CONSTRAINT "studio_inspiration_reactions_project_studio_projects_id_fk" FOREIGN KEY ("project") REFERENCES "public"."studio_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio_inspiration_reactions" ADD CONSTRAINT "studio_inspiration_reactions_inspiration_studio_inspiration_id_fk" FOREIGN KEY ("inspiration") REFERENCES "public"."studio_inspiration"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "studio_inspiration_reactions_actor_unique" ON "studio_inspiration_reactions" USING btree ("inspiration","actor");--> statement-breakpoint
CREATE INDEX "studio_inspiration_reactions_project" ON "studio_inspiration_reactions" USING btree ("project");