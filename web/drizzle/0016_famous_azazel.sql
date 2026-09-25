CREATE TABLE "billing_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"studio" text NOT NULL,
	"provider" text DEFAULT 'mercadopago' NOT NULL,
	"state" text DEFAULT 'trialing' NOT NULL,
	"plan" text DEFAULT 'prueba' NOT NULL,
	"price_version" text,
	"trial_started" bigint NOT NULL,
	"trial_ends" bigint NOT NULL,
	"grace_ends" bigint,
	"paid_through" bigint,
	"cancel_at" bigint,
	"created" bigint NOT NULL,
	"updated" bigint NOT NULL,
	CONSTRAINT "billing_accounts_studio_unique" UNIQUE("studio")
);
--> statement-breakpoint
CREATE TABLE "billing_changes" (
	"id" text PRIMARY KEY NOT NULL,
	"account" text NOT NULL,
	"subscription" text,
	"action" text NOT NULL,
	"from_state" text,
	"to_state" text,
	"from_plan" text,
	"to_plan" text,
	"reason" text,
	"created" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_charges" (
	"id" text PRIMARY KEY NOT NULL,
	"subscription" text NOT NULL,
	"provider" text DEFAULT 'mercadopago' NOT NULL,
	"external_id" text NOT NULL,
	"provider_status" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"currency" text NOT NULL,
	"period_start" bigint,
	"period_end" bigint,
	"occurred_at" bigint NOT NULL,
	"created" bigint NOT NULL,
	CONSTRAINT "billing_charges_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "billing_price_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"plan" text NOT NULL,
	"version" integer NOT NULL,
	"active" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'ARS' NOT NULL,
	"amount_cents" bigint NOT NULL,
	"project_limit" integer NOT NULL,
	"storage_limit_bytes" bigint NOT NULL,
	"professional_limit" integer NOT NULL,
	"client_limit" integer,
	"team_permissions" integer DEFAULT 0 NOT NULL,
	"advanced_admin" integer DEFAULT 0 NOT NULL,
	"priority_support" integer DEFAULT 0 NOT NULL,
	"effective_from" bigint NOT NULL,
	"created" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_studios" (
	"id" text PRIMARY KEY NOT NULL,
	"owner" text NOT NULL,
	"created" bigint NOT NULL,
	CONSTRAINT "billing_studios_owner_unique" UNIQUE("owner")
);
--> statement-breakpoint
CREATE TABLE "billing_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"account" text NOT NULL,
	"provider" text DEFAULT 'mercadopago' NOT NULL,
	"external_id" text,
	"external_reference" text NOT NULL,
	"price_version" text NOT NULL,
	"provider_status" text,
	"state" text DEFAULT 'pending' NOT NULL,
	"currency" text DEFAULT 'ARS' NOT NULL,
	"amount_cents" bigint NOT NULL,
	"checkout_url" text,
	"current_period_start" bigint,
	"current_period_end" bigint,
	"next_charge_at" bigint,
	"cancel_at" bigint,
	"created" bigint NOT NULL,
	"updated" bigint NOT NULL,
	CONSTRAINT "billing_subscriptions_external_id_unique" UNIQUE("external_id"),
	CONSTRAINT "billing_subscriptions_external_reference_unique" UNIQUE("external_reference")
);
--> statement-breakpoint
CREATE TABLE "billing_webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text DEFAULT 'mercadopago' NOT NULL,
	"external_key" text NOT NULL,
	"topic" text NOT NULL,
	"resource_id" text NOT NULL,
	"payload" text NOT NULL,
	"received_at" bigint NOT NULL,
	"processed_at" bigint,
	"outcome" text,
	CONSTRAINT "billing_webhook_events_external_key_unique" UNIQUE("external_key")
);
--> statement-breakpoint
ALTER TABLE "studio_clients" ADD COLUMN "archived" bigint;--> statement-breakpoint
ALTER TABLE "studio_projects" ADD COLUMN "archived" bigint;--> statement-breakpoint
ALTER TABLE "billing_accounts" ADD CONSTRAINT "billing_accounts_studio_billing_studios_id_fk" FOREIGN KEY ("studio") REFERENCES "public"."billing_studios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_accounts" ADD CONSTRAINT "billing_accounts_price_version_billing_price_versions_id_fk" FOREIGN KEY ("price_version") REFERENCES "public"."billing_price_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_changes" ADD CONSTRAINT "billing_changes_account_billing_accounts_id_fk" FOREIGN KEY ("account") REFERENCES "public"."billing_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_changes" ADD CONSTRAINT "billing_changes_subscription_billing_subscriptions_id_fk" FOREIGN KEY ("subscription") REFERENCES "public"."billing_subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_charges" ADD CONSTRAINT "billing_charges_subscription_billing_subscriptions_id_fk" FOREIGN KEY ("subscription") REFERENCES "public"."billing_subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_account_billing_accounts_id_fk" FOREIGN KEY ("account") REFERENCES "public"."billing_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_price_version_billing_price_versions_id_fk" FOREIGN KEY ("price_version") REFERENCES "public"."billing_price_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "billing_price_plan_version_unique" ON "billing_price_versions" USING btree ("plan","version");--> statement-breakpoint
CREATE INDEX "billing_price_active" ON "billing_price_versions" USING btree ("plan","active");--> statement-breakpoint
CREATE INDEX "billing_subscription_account" ON "billing_subscriptions" USING btree ("account");
--> statement-breakpoint
INSERT INTO billing_price_versions
  (id, plan, version, active, currency, amount_cents, project_limit, storage_limit_bytes,
   professional_limit, client_limit, team_permissions, advanced_admin, priority_support,
   effective_from, created)
VALUES
  ('prueba-v1', 'prueba', 1, 1, 'ARS', 0, 1, 1073741824, 3, 2, 0, 0, 0, 0, (extract(epoch from now()) * 1000)::bigint),
  ('inicial-v1', 'inicial', 1, 1, 'ARS', 2990000, 3, 5368709120, 3, 5, 0, 0, 0, 0, (extract(epoch from now()) * 1000)::bigint),
  ('estudio-v1', 'estudio', 1, 1, 'ARS', 7490000, 15, 107374182400, 5, NULL, 1, 0, 0, 0, (extract(epoch from now()) * 1000)::bigint),
  ('equipo-v1', 'equipo', 1, 1, 'ARS', 14990000, 50, 536870912000, 15, NULL, 1, 1, 1, 0, (extract(epoch from now()) * 1000)::bigint)
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO billing_studios (id, owner, created)
SELECT gen_random_uuid()::text, p.owner,
  coalesce(nullif(min(p.created), 0), (extract(epoch from now()) * 1000)::bigint)
FROM studio_projects p GROUP BY p.owner
ON CONFLICT (owner) DO NOTHING;
--> statement-breakpoint
INSERT INTO billing_accounts
  (id, studio, state, plan, trial_started, trial_ends, created, updated)
SELECT gen_random_uuid()::text, s.id, 'trialing', 'prueba', s.created,
  s.created + 14 * 86400000,
  (extract(epoch from now()) * 1000)::bigint,
  (extract(epoch from now()) * 1000)::bigint
FROM billing_studios s
ON CONFLICT (studio) DO NOTHING;
--> statement-breakpoint
CREATE FUNCTION billing_enforce_quota() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_owner text;
  v_resource text;
  v_now bigint := (extract(epoch from now()) * 1000)::bigint;
  v_account billing_accounts%ROWTYPE;
  v_price billing_price_versions%ROWTYPE;
  v_used bigint;
  v_delta bigint := 1;
BEGIN
  IF TG_TABLE_NAME = 'studio_projects' THEN
    IF TG_OP = 'INSERT' AND NEW.archived IS NULL OR
       TG_OP = 'UPDATE' AND OLD.archived IS NOT NULL AND NEW.archived IS NULL THEN
      v_owner := NEW.owner; v_resource := 'projects';
    ELSE RETURN NEW; END IF;
  ELSIF TG_TABLE_NAME = 'studio_clients' THEN
    IF TG_OP = 'INSERT' AND NEW.archived IS NULL OR
       TG_OP = 'UPDATE' AND OLD.archived IS NOT NULL AND NEW.archived IS NULL THEN
      v_owner := NEW.owner; v_resource := 'clients';
    ELSE RETURN NEW; END IF;
  ELSIF TG_TABLE_NAME = 'studio_team_members' THEN
    IF NEW.role = 'external' THEN RETURN NEW; END IF;
    IF TG_OP = 'UPDATE' AND OLD.accepted IS NOT NULL AND OLD.role <> 'external'
       AND NEW.role <> 'external' THEN RETURN NEW; END IF;
    v_owner := NEW.owner; v_resource := 'professionals';
  ELSIF TG_TABLE_NAME IN ('studio_uploads', 'studio_asset_uploads', 'studio_assets', 'studio_plans') THEN
    IF TG_OP <> 'INSERT' THEN RETURN NEW; END IF;
    SELECT owner INTO v_owner FROM studio_projects WHERE id = NEW.project;
    v_resource := 'storageBytes';
    v_delta := NEW.size;
    IF v_delta <= 0 THEN RAISE EXCEPTION 'billing_invalid_size'; END IF;
  ELSE RETURN NEW; END IF;

  IF v_owner IS NULL THEN RAISE EXCEPTION 'billing_studio_unavailable'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_owner, 0));
  SELECT a.* INTO v_account FROM billing_studios s
    JOIN billing_accounts a ON a.studio = s.id WHERE s.owner = v_owner;
  IF NOT FOUND THEN RAISE EXCEPTION 'billing_read_only'; END IF;
  IF NOT (
    v_account.state = 'trialing' AND v_now < v_account.trial_ends OR
    v_account.state = 'active' AND v_account.paid_through > v_now OR
    v_account.state IN ('past_due', 'grace_period') AND v_account.grace_ends > v_now OR
    v_account.state = 'canceling' AND v_account.paid_through > v_now
  ) THEN RAISE EXCEPTION 'billing_read_only'; END IF;
  SELECT * INTO v_price FROM billing_price_versions
    WHERE id = coalesce(v_account.price_version, 'prueba-v1');
  IF NOT FOUND THEN RAISE EXCEPTION 'billing_price_unavailable'; END IF;

  IF v_resource = 'projects' THEN
    SELECT count(*) INTO v_used FROM studio_projects
      WHERE owner = v_owner AND archived IS NULL;
    IF v_used + 1 > v_price.project_limit THEN RAISE EXCEPTION 'billing_limit_projects'; END IF;
  ELSIF v_resource = 'clients' THEN
    IF v_price.client_limit IS NOT NULL THEN
      SELECT count(*) INTO v_used FROM studio_clients
        WHERE owner = v_owner AND archived IS NULL;
      IF v_used + 1 > v_price.client_limit THEN RAISE EXCEPTION 'billing_limit_clients'; END IF;
    END IF;
  ELSIF v_resource = 'professionals' THEN
    IF TG_OP = 'INSERT' THEN
      SELECT count(DISTINCT lower(email)) INTO v_used FROM studio_team_members
        WHERE owner = v_owner AND role <> 'external'
          AND (accepted IS NOT NULL OR invite_expires > v_now);
      IF EXISTS (SELECT 1 FROM studio_team_members WHERE owner = v_owner
          AND role <> 'external' AND lower(email) = lower(NEW.email)
          AND (accepted IS NOT NULL OR invite_expires > v_now)) THEN v_delta := 0; END IF;
    ELSE
      SELECT count(DISTINCT lower(email)) INTO v_used FROM studio_team_members
        WHERE owner = v_owner AND role <> 'external' AND accepted IS NOT NULL
          AND id <> NEW.id;
    END IF;
    IF v_used + v_delta + 1 > v_price.professional_limit
      THEN RAISE EXCEPTION 'billing_limit_professionals'; END IF;
  ELSIF v_resource = 'storageBytes' THEN
    SELECT coalesce(sum(size), 0) INTO v_used FROM (
      SELECT DISTINCT ON (key) key, size FROM (
        SELECT a.key, a.size FROM studio_assets a JOIN studio_projects p ON p.id=a.project WHERE p.owner=v_owner
        UNION ALL
        SELECT a.key, a.size FROM studio_asset_uploads a JOIN studio_projects p ON p.id=a.project WHERE p.owner=v_owner
        UNION ALL
        SELECT u.key, u.size FROM studio_uploads u JOIN studio_projects p ON p.id=u.project WHERE p.owner=v_owner
        UNION ALL
        SELECT pl.key, pl.size FROM studio_plans pl JOIN studio_projects p ON p.id=pl.project WHERE p.owner=v_owner AND pl.key IS NOT NULL
      ) f ORDER BY key
    ) files;
    IF EXISTS (
      SELECT 1 FROM studio_assets a JOIN studio_projects p ON p.id=a.project WHERE p.owner=v_owner AND a.key=NEW.key
      UNION ALL SELECT 1 FROM studio_asset_uploads a JOIN studio_projects p ON p.id=a.project WHERE p.owner=v_owner AND a.key=NEW.key
      UNION ALL SELECT 1 FROM studio_uploads u JOIN studio_projects p ON p.id=u.project WHERE p.owner=v_owner AND u.key=NEW.key
      UNION ALL SELECT 1 FROM studio_plans pl JOIN studio_projects p ON p.id=pl.project WHERE p.owner=v_owner AND pl.key=NEW.key
    ) THEN v_delta := 0; END IF;
    IF v_used + v_delta > v_price.storage_limit_bytes
      THEN RAISE EXCEPTION 'billing_limit_storageBytes'; END IF;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER billing_projects_limit BEFORE INSERT OR UPDATE OF archived ON studio_projects
  FOR EACH ROW EXECUTE FUNCTION billing_enforce_quota();
--> statement-breakpoint
CREATE TRIGGER billing_clients_limit BEFORE INSERT OR UPDATE OF archived ON studio_clients
  FOR EACH ROW EXECUTE FUNCTION billing_enforce_quota();
--> statement-breakpoint
CREATE TRIGGER billing_professionals_limit BEFORE INSERT OR UPDATE OF accepted, role ON studio_team_members
  FOR EACH ROW EXECUTE FUNCTION billing_enforce_quota();
--> statement-breakpoint
CREATE TRIGGER billing_model_storage_limit BEFORE INSERT ON studio_uploads
  FOR EACH ROW EXECUTE FUNCTION billing_enforce_quota();
--> statement-breakpoint
CREATE TRIGGER billing_asset_reservation_limit BEFORE INSERT ON studio_asset_uploads
  FOR EACH ROW EXECUTE FUNCTION billing_enforce_quota();
--> statement-breakpoint
CREATE TRIGGER billing_asset_storage_limit BEFORE INSERT ON studio_assets
  FOR EACH ROW EXECUTE FUNCTION billing_enforce_quota();
--> statement-breakpoint
CREATE TRIGGER billing_plan_storage_limit BEFORE INSERT ON studio_plans
  FOR EACH ROW EXECUTE FUNCTION billing_enforce_quota();
