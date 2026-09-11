CREATE TABLE "studio_comments" (
	"id" text PRIMARY KEY NOT NULL,
	"project" text NOT NULL,
	"version" text NOT NULL,
	"author" text NOT NULL,
	"text" text NOT NULL,
	"surface" text NOT NULL,
	"point" text,
	"state" text DEFAULT 'abierto' NOT NULL,
	"created" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "studio_projects" (
	"id" text PRIMARY KEY NOT NULL,
	"owner" text NOT NULL,
	"share" text NOT NULL,
	CONSTRAINT "studio_projects_owner_unique" UNIQUE("owner"),
	CONSTRAINT "studio_projects_share_unique" UNIQUE("share")
);
--> statement-breakpoint
CREATE TABLE "studio_uploads" (
	"id" text PRIMARY KEY NOT NULL,
	"project" text NOT NULL,
	"key" text NOT NULL,
	"upload_id" text NOT NULL,
	"name" text NOT NULL,
	"size" bigint NOT NULL,
	"completed" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "studio_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"project" text NOT NULL,
	"name" text NOT NULL,
	"files" text NOT NULL,
	"published" integer DEFAULT 0 NOT NULL,
	"created" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "studio_comments" ADD CONSTRAINT "studio_comments_project_studio_projects_id_fk" FOREIGN KEY ("project") REFERENCES "public"."studio_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio_uploads" ADD CONSTRAINT "studio_uploads_project_studio_projects_id_fk" FOREIGN KEY ("project") REFERENCES "public"."studio_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio_versions" ADD CONSTRAINT "studio_versions_project_studio_projects_id_fk" FOREIGN KEY ("project") REFERENCES "public"."studio_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "studio_comments_project_version" ON "studio_comments" USING btree ("project","version");--> statement-breakpoint
CREATE INDEX "studio_versions_project" ON "studio_versions" USING btree ("project");