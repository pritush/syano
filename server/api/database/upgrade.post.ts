import { defineEventHandler } from 'h3'
import { sql } from 'drizzle-orm'
import { useDrizzle } from '~/server/utils/db'

export default defineEventHandler(async (event) => {
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

    return { success: true, message: 'Database schema upgraded successfully!' }
  } catch (err: any) {
    return { success: false, error: err.message || 'Unknown error occurred during migration.' }
  }
})
