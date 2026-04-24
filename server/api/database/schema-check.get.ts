import { defineEventHandler } from 'h3'
import { sql } from 'drizzle-orm'
import { useDrizzle } from '~/server/utils/db'

export default defineEventHandler(async (event) => {
  const db = await useDrizzle(event)

  try {
    const tableCheck = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'qr_scans'
      );
    `)
    const hasQrScans = tableCheck.rows[0]?.exists

    const colCheck = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'site_settings' AND column_name = 'redirect_timeout'
      );
    `)
    const hasTimeout = colCheck.rows[0]?.exists

    const utmCheck = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'access_logs' AND column_name = 'utm_source'
      );
    `)
    const hasUtm = utmCheck.rows[0]?.exists

    const missing = []
    if (!hasQrScans) missing.push('New table for tracking QR code scans')
    if (!hasTimeout) missing.push('New redirect delay configuration field')
    if (!hasUtm) missing.push('Analytics UTM parameters tracking')

    return {
      upToDate: hasQrScans && hasTimeout && hasUtm,
      missing
    }
  } catch (err: any) {
    return { upToDate: true, missing: [], error: err.message } // Fail safe so it doesn't brick UX
  }
})
