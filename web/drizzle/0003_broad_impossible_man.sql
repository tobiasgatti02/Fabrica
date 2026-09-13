CREATE TABLE "studio_clients" (
	"id" text PRIMARY KEY NOT NULL,
	"owner" text NOT NULL,
	"name" text NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"created" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "studio_projects" ADD COLUMN "client" text;--> statement-breakpoint
CREATE INDEX "studio_clients_owner" ON "studio_clients" USING btree ("owner");--> statement-breakpoint
ALTER TABLE "studio_projects" ADD CONSTRAINT "studio_projects_client_studio_clients_id_fk" FOREIGN KEY ("client") REFERENCES "public"."studio_clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "studio_projects_client" ON "studio_projects" USING btree ("client");