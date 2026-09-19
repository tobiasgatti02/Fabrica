CREATE TABLE "studio_budget_items" (
	"id" text PRIMARY KEY NOT NULL,
	"project" text NOT NULL,
	"title" text NOT NULL,
	"category" text DEFAULT 'General' NOT NULL,
	"planned" bigint DEFAULT 0 NOT NULL,
	"committed" bigint DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'estimated' NOT NULL,
	"client_visible" integer DEFAULT 1 NOT NULL,
	"created" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "studio_budget_items" ADD CONSTRAINT "studio_budget_items_project_studio_projects_id_fk" FOREIGN KEY ("project") REFERENCES "public"."studio_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "studio_budget_items_project" ON "studio_budget_items" USING btree ("project");