CREATE TABLE "studio_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires" bigint NOT NULL,
	"created" bigint NOT NULL,
	CONSTRAINT "studio_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "studio_users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"created" bigint NOT NULL,
	CONSTRAINT "studio_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "studio_projects" DROP CONSTRAINT "studio_projects_owner_unique";--> statement-breakpoint
ALTER TABLE "studio_comments" ADD COLUMN "scope" text DEFAULT 'point' NOT NULL;--> statement-breakpoint
ALTER TABLE "studio_comments" ADD COLUMN "camera" text;--> statement-breakpoint
ALTER TABLE "studio_projects" ADD COLUMN "name" text DEFAULT 'Proyecto sin nombre' NOT NULL;--> statement-breakpoint
ALTER TABLE "studio_projects" ADD COLUMN "created" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "studio_versions" ADD COLUMN "views" text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE "studio_sessions" ADD CONSTRAINT "studio_sessions_user_studio_users_id_fk" FOREIGN KEY ("user") REFERENCES "public"."studio_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "studio_sessions_user" ON "studio_sessions" USING btree ("user");--> statement-breakpoint
CREATE INDEX "studio_sessions_expires" ON "studio_sessions" USING btree ("expires");--> statement-breakpoint
CREATE INDEX "studio_projects_owner" ON "studio_projects" USING btree ("owner");