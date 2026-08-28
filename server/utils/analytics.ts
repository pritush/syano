import type { H3Event } from 'h3'
import { usePool } from '~/server/utils/db'
import type { AnalyticsQuery } from '~/shared/schemas/analytics'

type QueryFragment = {
  joins: string[]
  where: string[]
  values: Array<string | number>
}

function buildFilterSql(filters: AnalyticsQuery): QueryFragment {
  const fragment: QueryFragment = {
    joins: [],
    where: [],
    values: [],
  }

  if (filters.start_date && filters.end_date) {
    fragment.values.push(filters.start_date)
    fragment.where.push(`a.created_at >= $${fragment.values.length}::timestamp`)
    fragment.values.push(filters.end_date)
    fragment.where.push(`a.created_at < $${fragment.values.length}::timestamp + interval '1 day'`)
  } else {
    fragment.values.push(filters.days || 30)
    fragment.where.push(`a.created_at >= NOW() - ($${fragment.values.length} * interval '1 day')`)
  }

  if (filters.slug) {
    fragment.values.push(filters.slug)
    fragment.where.push(`a.slug = $${fragment.values.length}`)
  }

  if (filters.tag_id) {
    fragment.joins.push('LEFT JOIN links l ON l.id = a.link_id')
    fragment.values.push(filters.tag_id)
    fragment.where.push(`l.tag_id = $${fragment.values.length}`)
  }

  return fragment
}

function renderScope(fragment: QueryFragment) {
  const joins = fragment.joins.join(' ')
  const where = fragment.where.length ? `WHERE ${fragment.where.join(' AND ')}` : ''
  return { joins, where, values: fragment.values }
}

export { renderScope, buildFilterSql }

export async function getAnalyticsCounters(event: H3Event, filters: AnalyticsQuery) {
  const pool = await usePool(event)
  const scope = renderScope(buildFilterSql(filters))

  const { rows } = await pool.query(
    `
      SELECT
        COUNT(*)::int AS total_clicks,
        COUNT(*) FILTER (WHERE a.created_at >= NOW() - interval '1 day')::int AS clicks_last_24h,
        COUNT(*) FILTER (WHERE a.created_at >= NOW() - interval '7 day')::int AS clicks_last_7d,
        COUNT(DISTINCT COALESCE(a.slug, ''))::int AS unique_slugs
      FROM access_logs a
      ${scope.joins}
      ${scope.where}
    `,
    scope.values,
  )

  return rows[0] || {
    total_clicks: 0,
    clicks_last_24h: 0,
    clicks_last_7d: 0,
    unique_slugs: 0,
  }
}

export async function getAnalyticsViews(event: H3Event, filters: AnalyticsQuery) {
  const pool = await usePool(event)
  const scope = renderScope(buildFilterSql(filters))

  const { rows } = await pool.query(
    `
      SELECT
        TO_CHAR(DATE_TRUNC('day', a.created_at), 'YYYY-MM-DD') AS day,
        COUNT(*)::int AS views
      FROM access_logs a
      ${scope.joins}
      ${scope.where}
      GROUP BY 1
      ORDER BY 1 ASC
    `,
    scope.values,
  )

  return rows
}

export async function getAnalyticsMetrics(event: H3Event, filters: AnalyticsQuery) {
  const pool = await usePool(event)
  const scope = renderScope(buildFilterSql(filters))

  // Single CTE query: materialize filtered data once, then aggregate 12 dimensions.
  // Each SELECT leg is wrapped in parentheses so ORDER BY / LIMIT apply per-leg
  // (PostgreSQL requires this for UNION ALL).
  const { rows } = await pool.query(
    `
      WITH filtered AS (
        SELECT a.device_type, a.browser, a.country, a.os, a.language,
               a.timezone, a.referer,
               a.utm_source, a.utm_medium, a.utm_campaign, a.utm_term, a.utm_content
        FROM access_logs a
        ${scope.joins}
        ${scope.where}
      )
      (SELECT 'device' AS metric, COALESCE(NULLIF(device_type, ''), 'unknown') AS label, COUNT(*)::int AS views FROM filtered GROUP BY 2 ORDER BY views DESC, label ASC LIMIT 6)
      UNION ALL
      (SELECT 'browser', COALESCE(NULLIF(browser, ''), 'unknown'), COUNT(*)::int FROM filtered GROUP BY 2 ORDER BY 3 DESC, 2 ASC LIMIT 6)
      UNION ALL
      (SELECT 'country', COALESCE(NULLIF(country, ''), 'unknown'), COUNT(*)::int FROM filtered GROUP BY 2 ORDER BY 3 DESC, 2 ASC LIMIT 6)
      UNION ALL
      (SELECT 'os', COALESCE(NULLIF(os, ''), 'unknown'), COUNT(*)::int FROM filtered GROUP BY 2 ORDER BY 3 DESC, 2 ASC LIMIT 6)
      UNION ALL
      (SELECT 'language', COALESCE(NULLIF(language, ''), 'unknown'), COUNT(*)::int FROM filtered GROUP BY 2 ORDER BY 3 DESC, 2 ASC LIMIT 6)
      UNION ALL
      (SELECT 'timezone', COALESCE(NULLIF(timezone, ''), 'unknown'), COUNT(*)::int FROM filtered GROUP BY 2 ORDER BY 3 DESC, 2 ASC LIMIT 6)
      UNION ALL
      (SELECT 'referrer',
        CASE WHEN referer IS NULL OR referer = '' THEN 'direct'
             ELSE regexp_replace(referer, '^https?://([^/]+)/?.*$', '\\1')
        END,
        COUNT(*)::int FROM filtered GROUP BY 2 ORDER BY 3 DESC, 2 ASC LIMIT 6)
      UNION ALL
      (SELECT 'utm_source', COALESCE(NULLIF(utm_source, ''), 'unknown'), COUNT(*)::int FROM filtered GROUP BY 2 ORDER BY 3 DESC, 2 ASC LIMIT 6)
      UNION ALL
      (SELECT 'utm_medium', COALESCE(NULLIF(utm_medium, ''), 'unknown'), COUNT(*)::int FROM filtered GROUP BY 2 ORDER BY 3 DESC, 2 ASC LIMIT 6)
      UNION ALL
      (SELECT 'utm_campaign', COALESCE(NULLIF(utm_campaign, ''), 'unknown'), COUNT(*)::int FROM filtered GROUP BY 2 ORDER BY 3 DESC, 2 ASC LIMIT 6)
      UNION ALL
      (SELECT 'utm_term', COALESCE(NULLIF(utm_term, ''), 'unknown'), COUNT(*)::int FROM filtered GROUP BY 2 ORDER BY 3 DESC, 2 ASC LIMIT 6)
      UNION ALL
      (SELECT 'utm_content', COALESCE(NULLIF(utm_content, ''), 'unknown'), COUNT(*)::int FROM filtered GROUP BY 2 ORDER BY 3 DESC, 2 ASC LIMIT 6)
    `,
    scope.values,
  )

  // Partition rows by metric type
  const result: Record<string, Array<{ label: string; views: number }>> = {
    devices: [], browsers: [], countries: [], operating_systems: [],
    languages: [], timezones: [], referrers: [],
    utm_sources: [], utm_mediums: [], utm_campaigns: [], utm_terms: [], utm_contents: [],
  }

  const metricToKey: Record<string, string> = {
    device: 'devices', browser: 'browsers', country: 'countries', os: 'operating_systems',
    language: 'languages', timezone: 'timezones', referrer: 'referrers',
    utm_source: 'utm_sources', utm_medium: 'utm_mediums', utm_campaign: 'utm_campaigns',
    utm_term: 'utm_terms', utm_content: 'utm_contents',
  }

  for (const row of rows) {
    const key = metricToKey[row.metric as string]
    if (key) {
      result[key]!.push({ label: row.label as string, views: row.views as number })
    }
  }

  return result
}

export async function getAnalyticsHeatmap(event: H3Event, filters: AnalyticsQuery) {
  const pool = await usePool(event)
  const scope = renderScope(buildFilterSql(filters))

  const { rows } = await pool.query(
    `
      SELECT
        EXTRACT(DOW FROM a.created_at)::int AS day_of_week,
        EXTRACT(HOUR FROM a.created_at)::int AS hour,
        COUNT(*)::int AS views
      FROM access_logs a
      ${scope.joins}
      ${scope.where}
      GROUP BY 1, 2
      ORDER BY 1 ASC, 2 ASC
    `,
    scope.values,
  )

  return rows
}

export async function getAnalyticsEvents(event: H3Event, filters: AnalyticsQuery) {
  const pool = await usePool(event)
  const scopedFilters = { ...filters, limit: filters.limit || 50 }
  const scope = renderScope(buildFilterSql(scopedFilters))
  const values = [...scope.values, scopedFilters.limit]

  const { rows } = await pool.query(
    `
      SELECT
        a.id,
        a.slug,
        a.url,
        a.country,
        a.region,
        a.city,
        a.referer,
        a.browser,
        a.device_type,
        a.created_at
      FROM access_logs a
      ${scope.joins}
      ${scope.where}
      ORDER BY a.created_at DESC
      LIMIT $${values.length}
    `,
    values,
  )

  return rows
}

export async function getAnalyticsLocations(event: H3Event, filters: AnalyticsQuery) {
  const pool = await usePool(event)
  const scope = renderScope(buildFilterSql(filters))

  const { rows } = await pool.query(
    `
      SELECT
        COALESCE(NULLIF(a.country, ''), 'unknown') AS country,
        COALESCE(NULLIF(a.region, ''), 'unknown') AS region,
        COALESCE(NULLIF(a.city, ''), 'unknown') AS city,
        MAX(a.latitude) AS latitude,
        MAX(a.longitude) AS longitude,
        COUNT(*)::int AS views
      FROM access_logs a
      ${scope.joins}
      ${scope.where}
      GROUP BY 1, 2, 3
      ORDER BY 6 DESC, 1 ASC
      LIMIT 25
    `,
    scope.values,
  )

  return rows
}

export async function getQrScans(event: H3Event, filters: AnalyticsQuery) {
  const pool = await usePool(event)
  const fragment = buildFilterSql(filters)
  const scope = renderScope(fragment)

  const { rows } = await pool.query<{ qr_scans: number }>(
    `
      SELECT COUNT(*)::int AS qr_scans
      FROM qr_scans a
      ${scope.joins}
      ${scope.where}
    `,
    scope.values,
  )

  return { qr_scans: rows[0]?.qr_scans || 0 }
}
