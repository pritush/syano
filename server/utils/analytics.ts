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

  fragment.values.push(filters.days)
  fragment.where.push(`a.created_at >= NOW() - ($${fragment.values.length} * interval '1 day')`)

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

  const [devices, browsers, countries, operatingSystems, languages, timezones, referrers] = await Promise.all([
    pool.query(
      `
        SELECT COALESCE(NULLIF(a.device_type, ''), 'unknown') AS label, COUNT(*)::int AS views
        FROM access_logs a
        ${scope.joins}
        ${scope.where}
        GROUP BY 1
        ORDER BY 2 DESC, 1 ASC
        LIMIT 6
      `,
      scope.values,
    ),
    pool.query(
      `
        SELECT COALESCE(NULLIF(a.browser, ''), 'unknown') AS label, COUNT(*)::int AS views
        FROM access_logs a
        ${scope.joins}
        ${scope.where}
        GROUP BY 1
        ORDER BY 2 DESC, 1 ASC
        LIMIT 6
      `,
      scope.values,
    ),
    pool.query(
      `
        SELECT COALESCE(NULLIF(a.country, ''), 'unknown') AS label, COUNT(*)::int AS views
        FROM access_logs a
        ${scope.joins}
        ${scope.where}
        GROUP BY 1
        ORDER BY 2 DESC, 1 ASC
        LIMIT 6
      `,
      scope.values,
    ),
    pool.query(
      `
        SELECT COALESCE(NULLIF(a.os, ''), 'unknown') AS label, COUNT(*)::int AS views
        FROM access_logs a
        ${scope.joins}
        ${scope.where}
        GROUP BY 1
        ORDER BY 2 DESC, 1 ASC
        LIMIT 6
      `,
      scope.values,
    ),
    pool.query(
      `
        SELECT COALESCE(NULLIF(a.language, ''), 'unknown') AS label, COUNT(*)::int AS views
        FROM access_logs a
        ${scope.joins}
        ${scope.where}
        GROUP BY 1
        ORDER BY 2 DESC, 1 ASC
        LIMIT 6
      `,
      scope.values,
    ),
    pool.query(
      `
        SELECT COALESCE(NULLIF(a.timezone, ''), 'unknown') AS label, COUNT(*)::int AS views
        FROM access_logs a
        ${scope.joins}
        ${scope.where}
        GROUP BY 1
        ORDER BY 2 DESC, 1 ASC
        LIMIT 6
      `,
      scope.values,
    ),
    pool.query(
      `
        SELECT
          CASE
            WHEN a.referer IS NULL OR a.referer = '' THEN 'direct'
            ELSE regexp_replace(a.referer, '^https?://([^/]+)/?.*$', '\\1')
          END AS label,
          COUNT(*)::int AS views
        FROM access_logs a
        ${scope.joins}
        ${scope.where}
        GROUP BY 1
        ORDER BY 2 DESC, 1 ASC
        LIMIT 6
      `,
      scope.values,
    ),
  ])

  return {
    devices: devices.rows,
    browsers: browsers.rows,
    countries: countries.rows,
    operating_systems: operatingSystems.rows,
    languages: languages.rows,
    timezones: timezones.rows,
    referrers: referrers.rows,
  }
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
