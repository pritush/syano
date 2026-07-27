-- Complete the fresh-install setup that is intentionally kept outside the
-- Drizzle table declarations: defaults, the update trigger, and runtime
-- indexes. This runs after 0001 on an empty database.

CREATE INDEX IF NOT EXISTS "idx_access_logs_created_at" ON "access_logs" USING btree ("created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_access_logs_country" ON "access_logs" USING btree ("country") WHERE "access_logs"."country" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_access_logs_slug_date" ON "access_logs" USING btree ("slug", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_access_logs_link_date" ON "access_logs" USING btree ("link_id", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_access_logs_browser" ON "access_logs" USING btree ("browser_type") WHERE "access_logs"."browser_type" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_access_logs_device" ON "access_logs" USING btree ("device_type") WHERE "access_logs"."device_type" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_access_logs_os" ON "access_logs" USING btree ("os") WHERE "access_logs"."os" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_access_logs_referer" ON "access_logs" USING btree ("referer") WHERE "access_logs"."referer" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_qr_scans_link_date" ON "qr_scans" USING btree ("link_id", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_qr_scans_slug" ON "qr_scans" USING btree ("slug");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_links_tag_id_filter" ON "links" USING btree ("tag_id") WHERE "links"."tag_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_links_expiration" ON "links" USING btree ("expiration") WHERE "links"."expiration" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_api_rate_limits_key_endpoint" ON "api_rate_limits" USING btree ("api_key_id", "endpoint", "window_start");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_links_id_tag" ON "links" USING btree ("id" DESC, "tag_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_users_username" ON "users" USING btree ("username");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_logs_created_at" ON "audit_logs" USING btree ("created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_logs_action" ON "audit_logs" USING btree ("action");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_logs_entity_type" ON "audit_logs" USING btree ("entity_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_logs_actor" ON "audit_logs" USING btree ("actor_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_api_keys_user_id" ON "api_keys" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_api_keys_key_prefix" ON "api_keys" USING btree ("key_prefix");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_api_keys_key_hash" ON "api_keys" USING btree ("key_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_webhooks_user_id" ON "webhooks" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_webhook_deliveries_webhook_id" ON "webhook_deliveries" USING btree ("webhook_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_webhook_deliveries_delivered_at" ON "webhook_deliveries" USING btree ("delivered_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_api_rate_limits_api_key_id" ON "api_rate_limits" USING btree ("api_key_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_api_rate_limits_window_start" ON "api_rate_limits" USING btree ("window_start");
--> statement-breakpoint
INSERT INTO "site_settings" ("id", "homepage_mode", "redirect_url", "redirect_timeout", "bio_content")
VALUES (
  'default',
  'DEFAULT',
  NULL,
  3,
  '{"profile": {"name": "Syano", "bio": null, "initials": "SY", "avatar_url": null}, "links": [], "socials": []}'::jsonb
)
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.links'::regclass
      AND tgname = 'update_links_updated_at'
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER update_links_updated_at
      BEFORE UPDATE ON links
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
