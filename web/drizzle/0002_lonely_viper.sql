CREATE TABLE "studio_measurements" (
	"id" text PRIMARY KEY NOT NULL,
	"project" text NOT NULL,
	"version" text NOT NULL,
	"name" text NOT NULL,
	"start_point" text NOT NULL,
	"end_point" text NOT NULL,
	"value" double precision NOT NULL,
	"unit" text DEFAULT 'm' NOT NULL,
	"created_by" text NOT NULL,
	"created" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "studio_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"project" text NOT NULL,
	"version" text NOT NULL,
	"name" text NOT NULL,
	"sheet" text DEFAULT '' NOT NULL,
	"mime" text DEFAULT 'application/pdf' NOT NULL,
	"key" text,
	"size" bigint DEFAULT 0 NOT NULL,
	"created_by" text NOT NULL,
	"created" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "studio_comments" ADD COLUMN "anchor" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "studio_comments" ADD COLUMN "parent" text;--> statement-breakpoint
ALTER TABLE "studio_versions" ADD COLUMN "description" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "studio_versions" ADD COLUMN "sequence" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "studio_versions" ADD COLUMN "source_version" text;--> statement-breakpoint
ALTER TABLE "studio_versions" ADD COLUMN "model_kind" text DEFAULT 'files' NOT NULL;--> statement-breakpoint
ALTER TABLE "studio_versions" ADD COLUMN "settings" text DEFAULT '{"hiddenObjects":[],"palette":"warm"}' NOT NULL;--> statement-breakpoint
ALTER TABLE "studio_versions" ADD COLUMN "unit" text DEFAULT 'm' NOT NULL;--> statement-breakpoint
ALTER TABLE "studio_measurements" ADD CONSTRAINT "studio_measurements_project_studio_projects_id_fk" FOREIGN KEY ("project") REFERENCES "public"."studio_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio_measurements" ADD CONSTRAINT "studio_measurements_version_studio_versions_id_fk" FOREIGN KEY ("version") REFERENCES "public"."studio_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio_plans" ADD CONSTRAINT "studio_plans_project_studio_projects_id_fk" FOREIGN KEY ("project") REFERENCES "public"."studio_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio_plans" ADD CONSTRAINT "studio_plans_version_studio_versions_id_fk" FOREIGN KEY ("version") REFERENCES "public"."studio_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "studio_measurements_project_version" ON "studio_measurements" USING btree ("project","version");--> statement-breakpoint
CREATE INDEX "studio_plans_project_version" ON "studio_plans" USING btree ("project","version");--> statement-breakpoint
CREATE INDEX "studio_versions_project_sequence" ON "studio_versions" USING btree ("project","sequence");