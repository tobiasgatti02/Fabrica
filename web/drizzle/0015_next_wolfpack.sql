CREATE TABLE "studio_presence" (
	"id" text PRIMARY KEY NOT NULL,
	"secret_hash" text NOT NULL,
	"project" text NOT NULL,
	"version" text NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"cursor" text,
	"camera" text,
	"expires" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "studio_presence" ADD CONSTRAINT "studio_presence_project_studio_projects_id_fk" FOREIGN KEY ("project") REFERENCES "public"."studio_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "studio_presence_room" ON "studio_presence" USING btree ("project","version","expires");--> statement-breakpoint
CREATE INDEX "studio_presence_expires" ON "studio_presence" USING btree ("expires");