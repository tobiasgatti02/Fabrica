CREATE TABLE "studio_asset_uploads" (
	"id" text PRIMARY KEY NOT NULL,
	"project" text NOT NULL,
	"key" text NOT NULL,
	"upload_id" text NOT NULL,
	"name" text NOT NULL,
	"mime" text NOT NULL,
	"size" bigint NOT NULL,
	"created" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "studio_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"project" text NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"mime" text NOT NULL,
	"size" bigint NOT NULL,
	"created" bigint NOT NULL,
	CONSTRAINT "studio_assets_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "studio_inspiration" (
	"id" text PRIMARY KEY NOT NULL,
	"project" text NOT NULL,
	"title" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"url" text DEFAULT '' NOT NULL,
	"asset" text,
	"category" text DEFAULT 'general' NOT NULL,
	"status" text DEFAULT 'idea' NOT NULL,
	"author" text NOT NULL,
	"created" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "studio_proposal_feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"proposal" text NOT NULL,
	"option" text,
	"author" text NOT NULL,
	"kind" text DEFAULT 'comment' NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"created" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "studio_proposal_options" (
	"id" text PRIMARY KEY NOT NULL,
	"proposal" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"asset" text,
	"url" text DEFAULT '' NOT NULL,
	"cost_note" text DEFAULT '' NOT NULL,
	"time_note" text DEFAULT '' NOT NULL,
	"created" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "studio_proposals" (
	"id" text PRIMARY KEY NOT NULL,
	"project" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"selected_option" text,
	"created" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "studio_tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"project" text NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'todo' NOT NULL,
	"due_date" text,
	"assignee" text,
	"created" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "studio_team_members" (
	"id" text PRIMARY KEY NOT NULL,
	"owner" text NOT NULL,
	"project" text,
	"email" text NOT NULL,
	"user" text,
	"name" text DEFAULT '' NOT NULL,
	"role" text DEFAULT 'architect' NOT NULL,
	"invite_hash" text NOT NULL,
	"invite_expires" bigint NOT NULL,
	"created" bigint NOT NULL,
	"accepted" bigint,
	CONSTRAINT "studio_team_members_invite_hash_unique" UNIQUE("invite_hash")
);
--> statement-breakpoint
ALTER TABLE "studio_projects" ADD COLUMN "stage" text DEFAULT 'idea' NOT NULL;--> statement-breakpoint
ALTER TABLE "studio_projects" ADD COLUMN "description" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "studio_projects" ADD COLUMN "start_date" text;--> statement-breakpoint
ALTER TABLE "studio_projects" ADD COLUMN "due_date" text;--> statement-breakpoint
ALTER TABLE "studio_asset_uploads" ADD CONSTRAINT "studio_asset_uploads_project_studio_projects_id_fk" FOREIGN KEY ("project") REFERENCES "public"."studio_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio_assets" ADD CONSTRAINT "studio_assets_project_studio_projects_id_fk" FOREIGN KEY ("project") REFERENCES "public"."studio_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio_inspiration" ADD CONSTRAINT "studio_inspiration_project_studio_projects_id_fk" FOREIGN KEY ("project") REFERENCES "public"."studio_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio_inspiration" ADD CONSTRAINT "studio_inspiration_asset_studio_assets_id_fk" FOREIGN KEY ("asset") REFERENCES "public"."studio_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio_proposal_feedback" ADD CONSTRAINT "studio_proposal_feedback_proposal_studio_proposals_id_fk" FOREIGN KEY ("proposal") REFERENCES "public"."studio_proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio_proposal_feedback" ADD CONSTRAINT "studio_proposal_feedback_option_studio_proposal_options_id_fk" FOREIGN KEY ("option") REFERENCES "public"."studio_proposal_options"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio_proposal_options" ADD CONSTRAINT "studio_proposal_options_proposal_studio_proposals_id_fk" FOREIGN KEY ("proposal") REFERENCES "public"."studio_proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio_proposal_options" ADD CONSTRAINT "studio_proposal_options_asset_studio_assets_id_fk" FOREIGN KEY ("asset") REFERENCES "public"."studio_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio_proposals" ADD CONSTRAINT "studio_proposals_project_studio_projects_id_fk" FOREIGN KEY ("project") REFERENCES "public"."studio_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio_tasks" ADD CONSTRAINT "studio_tasks_project_studio_projects_id_fk" FOREIGN KEY ("project") REFERENCES "public"."studio_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio_team_members" ADD CONSTRAINT "studio_team_members_project_studio_projects_id_fk" FOREIGN KEY ("project") REFERENCES "public"."studio_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "studio_assets_project" ON "studio_assets" USING btree ("project");--> statement-breakpoint
CREATE INDEX "studio_inspiration_project" ON "studio_inspiration" USING btree ("project");--> statement-breakpoint
CREATE INDEX "studio_proposal_feedback_proposal" ON "studio_proposal_feedback" USING btree ("proposal");--> statement-breakpoint
CREATE INDEX "studio_proposal_options_proposal" ON "studio_proposal_options" USING btree ("proposal");--> statement-breakpoint
CREATE INDEX "studio_proposals_project" ON "studio_proposals" USING btree ("project");--> statement-breakpoint
CREATE INDEX "studio_tasks_project" ON "studio_tasks" USING btree ("project");--> statement-breakpoint
CREATE INDEX "studio_team_members_owner" ON "studio_team_members" USING btree ("owner");--> statement-breakpoint
CREATE INDEX "studio_team_members_user" ON "studio_team_members" USING btree ("user");--> statement-breakpoint
CREATE INDEX "studio_team_members_project" ON "studio_team_members" USING btree ("project");