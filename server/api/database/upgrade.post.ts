import { defineEventHandler } from 'h3'
import { sql } from 'drizzle-orm'
import { useDrizzle } from '~/server/utils/db'
import { requirePermission } from '~/server/utils/auth'
import { PERMISSIONS } from '~/shared/permissions'

export default defineEventHandler(async (event) => {
  await requirePermission(event, PERMISSIONS.DATA_MANAGE)
  const db = await useDrizzle(event)

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

    return { success: true, message: 'Database schema upgraded successfully!' }
  } catch (err: any) {
    return { success: false, error: err.message || 'Unknown error occurred during migration.' }
  }
})
