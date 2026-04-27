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

    return { success: true, message: 'Database schema upgraded successfully!' }
  } catch (err: any) {
    return { success: false, error: err.message || 'Unknown error occurred during migration.' }
  }
})
