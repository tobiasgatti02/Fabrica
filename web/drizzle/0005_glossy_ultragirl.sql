ALTER TABLE "studio_clients" ADD COLUMN "account" text;--> statement-breakpoint
CREATE INDEX "studio_clients_account" ON "studio_clients" USING btree ("account");