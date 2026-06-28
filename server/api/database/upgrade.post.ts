import { defineEventHandler } from 'h3'
import { sql } from 'drizzle-orm'
import { useRuntimeConfig } from '#imports'
import { useDrizzle } from '~/server/utils/db'
import { requirePermission } from '~/server/utils/auth'
import { PERMISSIONS } from '~/shared/permissions'

type DrizzleDb = Awaited<ReturnType<typeof useDrizzle>>

async function createIndexSafe(db: DrizzleDb, name: string, statement: string, warnings: string[]) {
  try {
    await db.execute(sql.raw(statement))
  } catch (err: any) {
    warnings.push(`${name}: ${err.message || 'Unknown error'}`)
  }
}

export default defineEventHandler(async (event) => {
  await requirePermission(event, PERMISSIONS.DATA_MANAGE)
  const db = await useDrizzle(event)
  const indexWarnings: string[] = []

  try {
    // 1. Create the new table for tracking QR code scans
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "qr_scans" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "link_id" varchar(64) REFERENCES "links"("id") ON DELETE cascade,
        "slug" varchar(128),
        "created_at" timestamp with time zone DEFAULT now()
      );
    `)

    // 2. Add the redirect_timeout column
    await db.execute(sql`
      ALTER TABLE "site_settings"
      ADD COLUMN IF NOT EXISTS "redirect_timeout" bigint DEFAULT 3;
    `)

    // 3. Add UTM columns to access_logs
    await db.execute(sql`
      ALTER TABLE "access_logs"
      ADD COLUMN IF NOT EXISTS "utm_source" varchar(128),
      ADD COLUMN IF NOT EXISTS "utm_medium" varchar(128),
      ADD COLUMN IF NOT EXISTS "utm_campaign" varchar(128),
      ADD COLUMN IF NOT EXISTS "utm_term" varchar(128),
      ADD COLUMN IF NOT EXISTS "utm_content" varchar(128);
    `)

    // 4. Create the users table for dashboard user management
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "username" varchar(64) NOT NULL UNIQUE,
        "display_name" varchar(120),
        "password_hash" text NOT NULL,
        "permissions" text[] NOT NULL DEFAULT '{}',
        "is_active" boolean DEFAULT true,
        "created_at" timestamp with time zone DEFAULT now(),
        "updated_at" timestamp with time zone DEFAULT now()
      );
    `)

    // 5. Create index for users table
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    `)

    // 6. Create the audit_logs table for compliance and security tracking
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "audit_logs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "actor_id" varchar(64) NOT NULL,
        "actor_username" varchar(128) NOT NULL,
        "action" varchar(32) NOT NULL,
        "entity_type" varchar(32) NOT NULL,
        "entity_id" varchar(128),
        "entity_label" varchar(256),
        "details" jsonb,
        "ip" inet,
        "created_at" timestamp with time zone DEFAULT now()
      );
    `)

    // 7. Create indexes for audit_logs table
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
    `)
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
    `)
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type);
    `)
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id);
    `)

    // 8. Create the api_keys table for REST API authentication
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "api_keys" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" uuid REFERENCES "users"("id") ON DELETE CASCADE,
        "name" varchar(128) NOT NULL,
        "key_prefix" varchar(16) NOT NULL,
        "key_hash" text NOT NULL,
        "key_encrypted" text,
        "permissions" text[] NOT NULL DEFAULT '{}',
        "is_active" boolean DEFAULT true,
        "last_used_at" timestamp with time zone,
        "expires_at" timestamp with time zone,
        "created_at" timestamp with time zone DEFAULT now(),
        "updated_at" timestamp with time zone DEFAULT now()
      );
    `)

    // Add key_encrypted column if it doesn't exist (for existing installations)
    await db.execute(sql`
      ALTER TABLE api_keys 
      ADD COLUMN IF NOT EXISTS key_encrypted text;
    `)

    // 9. Create indexes for api_keys table
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
    `)
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
    `)

    // 10. Create the webhooks table for event notifications
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "webhooks" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" uuid REFERENCES "users"("id") ON DELETE CASCADE,
        "name" varchar(128) NOT NULL,
        "url" text NOT NULL,
        "events" text[] NOT NULL DEFAULT '{}',
        "secret" text NOT NULL,
        "is_active" boolean DEFAULT true,
        "failure_count" bigint DEFAULT 0,
        "last_triggered_at" timestamp with time zone,
        "created_at" timestamp with time zone DEFAULT now(),
        "updated_at" timestamp with time zone DEFAULT now()
      );
    `)

    // 11. Create indexes for webhooks table
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_webhooks_user_id ON webhooks(user_id);
    `)

    // 12. Create the webhook_deliveries table for tracking webhook calls
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "webhook_deliveries" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "webhook_id" uuid REFERENCES "webhooks"("id") ON DELETE CASCADE,
        "event_type" varchar(64) NOT NULL,
        "payload" jsonb NOT NULL,
        "response_status" bigint,
        "response_body" text,
        "error" text,
        "delivered_at" timestamp with time zone DEFAULT now()
      );
    `)

    // 13. Create indexes for webhook_deliveries table
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);
    `)
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_delivered_at ON webhook_deliveries(delivered_at DESC);
    `)

    // 14. Create the api_rate_limits table for API throttling
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "api_rate_limits" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "api_key_id" uuid REFERENCES "api_keys"("id") ON DELETE CASCADE,
        "endpoint" varchar(256) NOT NULL,
        "request_count" bigint DEFAULT 0,
        "window_start" timestamp with time zone DEFAULT now(),
        "created_at" timestamp with time zone DEFAULT now()
      );
    `)

    // 15. Create indexes for api_rate_limits table
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_api_rate_limits_api_key_id ON api_rate_limits(api_key_id);
    `)
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_api_rate_limits_window_start ON api_rate_limits(window_start);
    `)

    // 16. TRAI SMS Compliance
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "sender_ids" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" varchar(6) NOT NULL,
        "description" text,
        "is_active" boolean DEFAULT true,
        "is_default" boolean DEFAULT false,
        "created_at" timestamp with time zone DEFAULT now()
      );
    `)

    await db.execute(sql`
      ALTER TABLE "sender_ids" ADD COLUMN IF NOT EXISTS "is_default" boolean DEFAULT false;
    `)

    await db.execute(sql`
      ALTER TABLE "links" ADD COLUMN IF NOT EXISTS "sender_id" uuid;
    `)

    await db.execute(sql`
      ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "trai_sms_enabled" boolean DEFAULT false;
    `)

    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS "sender_ids_name_unique" ON "sender_ids" USING btree ("name");
    `)

    try {
      await db.execute(sql`
        ALTER TABLE "links" ADD CONSTRAINT "links_sender_id_sender_ids_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."sender_ids"("id") ON DELETE set null ON UPDATE no action;
      `)
    } catch (e: any) {
      if (e.code !== '42710' && !e.message?.includes('already exists')) {
        throw e;
      }
    }

    // 17. Query performance indexes (plain column indexes only — no expression indexes)
    const runtimeConfig = useRuntimeConfig(event)
    if (!runtimeConfig.caseSensitive) {
      await db.execute(sql`
        UPDATE links SET slug = LOWER(TRIM(slug)) WHERE slug <> LOWER(TRIM(slug))
      `)
    }

    await db.execute(sql`DROP INDEX IF EXISTS idx_links_slug_lower`)

    const performanceIndexes = [
      ['idx_links_slug', 'CREATE INDEX IF NOT EXISTS idx_links_slug ON links(slug)'],
      ['idx_access_logs_slug_date', 'CREATE INDEX IF NOT EXISTS idx_access_logs_slug_date ON access_logs(slug, created_at DESC)'],
      ['idx_access_logs_link_date', 'CREATE INDEX IF NOT EXISTS idx_access_logs_link_date ON access_logs(link_id, created_at DESC)'],
      ['idx_access_logs_browser', 'CREATE INDEX IF NOT EXISTS idx_access_logs_browser ON access_logs(browser_type) WHERE browser_type IS NOT NULL'],
      ['idx_access_logs_device', 'CREATE INDEX IF NOT EXISTS idx_access_logs_device ON access_logs(device_type) WHERE device_type IS NOT NULL'],
      ['idx_access_logs_os', 'CREATE INDEX IF NOT EXISTS idx_access_logs_os ON access_logs(os) WHERE os IS NOT NULL'],
      ['idx_access_logs_referer', 'CREATE INDEX IF NOT EXISTS idx_access_logs_referer ON access_logs(referer) WHERE referer IS NOT NULL'],
      ['idx_qr_scans_link_date', 'CREATE INDEX IF NOT EXISTS idx_qr_scans_link_date ON qr_scans(link_id, created_at DESC)'],
      ['idx_qr_scans_slug', 'CREATE INDEX IF NOT EXISTS idx_qr_scans_slug ON qr_scans(slug)'],
      ['idx_links_tag_id_filter', 'CREATE INDEX IF NOT EXISTS idx_links_tag_id_filter ON links(tag_id) WHERE tag_id IS NOT NULL'],
      ['idx_links_expiration', 'CREATE INDEX IF NOT EXISTS idx_links_expiration ON links(expiration) WHERE expiration IS NOT NULL'],
      ['idx_api_rate_limits_key_endpoint', 'CREATE INDEX IF NOT EXISTS idx_api_rate_limits_key_endpoint ON api_rate_limits(api_key_id, endpoint, window_start)'],
      ['idx_links_id_tag', 'CREATE INDEX IF NOT EXISTS idx_links_id_tag ON links(id DESC, tag_id)'],
      ['idx_audit_logs_actor_id', 'CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs(actor_id)'],
    ] as const

    for (const [name, statement] of performanceIndexes) {
      await createIndexSafe(db, name, statement, indexWarnings)
    }

    for (const table of ['links', 'access_logs', 'qr_scans', 'tags', 'api_keys', 'api_rate_limits'] as const) {
      await db.execute(sql.raw(`ANALYZE ${table}`))
    }

    const message = indexWarnings.length
      ? `Database schema upgraded with ${indexWarnings.length} index warning(s).`
      : 'Database schema upgraded successfully!'

    return {
      success: true,
      message,
      warnings: indexWarnings.length ? indexWarnings : undefined,
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Unknown error occurred during migration.' }
  }
})
