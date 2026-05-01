import { defineEventHandler, getRouterParam, getQuery, createError } from 'h3'
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm'
import { useDrizzle } from '~/server/utils/db'
import { links, access_logs, qr_scans } from '~/server/database/schema'
import { requireUnifiedAuth, requireUnifiedPermission } from '~/server/utils/unified-auth'
import { checkRateLimit } from '~/server/utils/rate-limit'

/**
 * Get analytics for a specific link
 * GET /api/v1/analytics/:slug
 * 
 * Authentication: Supports both JWT tokens (dashboard) and API keys (external)
 */
export default defineEventHandler(async (event) => {
  const auth = await requireUnifiedAuth(event)
  requireUnifiedPermission(auth, 'analytics:read')
  
  // Rate limit (only for API key requests)
  if (auth.type === 'apikey') {
    await checkRateLimit(event, {
      id: auth.apiKeyId!,
      user_id: auth.userId,
      name: auth.apiKeyName!,
      permissions: auth.permissions,
      key_prefix: auth.apiKeyPrefix!
    }, '/api/v1/analytics')
  }
  
  const slug = getRouterParam(event, 'slug')
  if (!slug) {
    throw createError({
      statusCode: 400,
      message: 'Slug parameter is required',
    })
  }
  
  const query = getQuery(event)
  const startDate = query.start_date ? new Date(query.start_date as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Default: 30 days ago
  const endDate = query.end_date ? new Date(query.end_date as string) : new Date()
  
  const db = await useDrizzle(event)
  
  // Check if link exists
  const [link] = await db
    .select()
    .from(links)
    .where(eq(links.slug, slug))
    .limit(1)
  
  if (!link) {
    throw createError({
      statusCode: 404,
      message: `Link with slug '${slug}' not found`,
    })
  }
  
  // Get total clicks from access_logs
  const clicksResult = await db
    .select({ totalClicks: sql<number>`count(*)::int` })
    .from(access_logs)
    .where(
      and(
        eq(access_logs.slug, slug),
        gte(access_logs.created_at, startDate),
        lte(access_logs.created_at, endDate)
      )
    )
  
  const totalClicks = clicksResult[0]?.totalClicks || 0
  
  // Get clicks by date
  const clicksByDate = await db
    .select({
      date: sql<string>`DATE(${access_logs.created_at})`,
      clicks: sql<number>`count(*)::int`,
    })
    .from(access_logs)
    .where(
      and(
        eq(access_logs.slug, slug),
        gte(access_logs.created_at, startDate),
        lte(access_logs.created_at, endDate)
      )
    )
    .groupBy(sql`DATE(${access_logs.created_at})`)
    .orderBy(sql`DATE(${access_logs.created_at})`)
  
  // Get clicks by country
  const clicksByCountry = await db
    .select({
      country: access_logs.country,
      clicks: sql<number>`count(*)::int`,
    })
    .from(access_logs)
    .where(
      and(
        eq(access_logs.slug, slug),
        gte(access_logs.created_at, startDate),
        lte(access_logs.created_at, endDate)
      )
    )
    .groupBy(access_logs.country)
    .orderBy(desc(sql`count(*)`))
    .limit(10)
  
  // Get clicks by device
  const clicksByDevice = await db
    .select({
      device: access_logs.device_type,
      clicks: sql<number>`count(*)::int`,
    })
    .from(access_logs)
    .where(
      and(
        eq(access_logs.slug, slug),
        gte(access_logs.created_at, startDate),
        lte(access_logs.created_at, endDate)
      )
    )
    .groupBy(access_logs.device_type)
    .orderBy(desc(sql`count(*)`))
  
  // Get clicks by browser
  const clicksByBrowser = await db
    .select({
      browser: access_logs.browser,
      clicks: sql<number>`count(*)::int`,
    })
    .from(access_logs)
    .where(
      and(
        eq(access_logs.slug, slug),
        gte(access_logs.created_at, startDate),
        lte(access_logs.created_at, endDate)
      )
    )
    .groupBy(access_logs.browser)
    .orderBy(desc(sql`count(*)`))
    .limit(10)
  
  // Get recent clicks
  const recentClicks = await db
    .select({
      id: access_logs.id,
      country: access_logs.country,
      city: access_logs.city,
      device_type: access_logs.device_type,
      browser: access_logs.browser,
      os: access_logs.os,
      created_at: access_logs.created_at,
    })
    .from(access_logs)
    .where(
      and(
        eq(access_logs.slug, slug),
        gte(access_logs.created_at, startDate),
        lte(access_logs.created_at, endDate)
      )
    )
    .orderBy(desc(access_logs.created_at))
    .limit(50)
  
  return {
    success: true,
    data: {
      link: {
        id: link.id,
        slug: link.slug,
        url: link.url,
        title: link.title,
        created_at: link.created_at,
      },
      period: {
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
      },
      summary: {
        total_clicks: totalClicks,
      },
      clicks_by_date: clicksByDate,
      clicks_by_country: clicksByCountry,
      clicks_by_device: clicksByDevice,
      clicks_by_browser: clicksByBrowser,
      recent_clicks: recentClicks,
    },
  }
})
