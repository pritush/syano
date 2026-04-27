import { defineEventHandler, getQuery, createError, setResponseHeaders } from 'h3'
import { desc, and, eq, gte, lte } from 'drizzle-orm'
import { requireAuth } from '~/server/utils/auth'
import { useDrizzle } from '~/server/utils/db'
import { audit_logs } from '~/server/database/schema'

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)

    if (!user.isRoot) {
      throw createError({ statusCode: 403, statusMessage: 'Forbidden: super admin only' })
    }

    const query = getQuery(event)
    const format = (query.format as string) || 'json'
    const dateFrom = (query.date_from as string) || ''
    const dateTo = (query.date_to as string) || ''

    const db = await useDrizzle(event)
    const filters = []

    if (dateFrom) {
      filters.push(gte(audit_logs.created_at, new Date(dateFrom)))
    }

    if (dateTo) {
      const endDate = new Date(dateTo)
      endDate.setDate(endDate.getDate() + 1)
      filters.push(lte(audit_logs.created_at, endDate))
    }

    const where = filters.length ? and(...filters) : undefined

    const items = await db
      .select()
      .from(audit_logs)
      .where(where)
      .orderBy(desc(audit_logs.created_at))
      .limit(10000) // Safety limit

    if (format === 'csv') {
      const header = 'Timestamp,Actor,Action,Entity Type,Entity ID,Entity Label,IP,Details'
      const rows = items.map((item) => {
        const ts = item.created_at ? new Date(item.created_at).toISOString() : ''
        const details = item.details ? JSON.stringify(item.details).replace(/"/g, '""') : ''
        return [
          ts,
          `"${(item.actor_username || '').replace(/"/g, '""')}"`,
          item.action,
          item.entity_type,
          `"${(item.entity_id || '').replace(/"/g, '""')}"`,
          `"${(item.entity_label || '').replace(/"/g, '""')}"`,
          item.ip || '',
          `"${details}"`,
        ].join(',')
      })

      const csv = [header, ...rows].join('\n')

      setResponseHeaders(event, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`,
      })

      return csv
    }

    // Default: JSON
    setResponseHeaders(event, {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.json"`,
    })

    return items
  } catch (error: any) {
    console.error('[Audit Logs] Error exporting audit logs:', error)
    
    // Check if it's a table doesn't exist error
    if (error?.message?.includes('relation "audit_logs" does not exist')) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Audit logs table not found',
        message: 'The audit_logs table does not exist in the database. Please run the migration: database/migrations/add_audit_logs.sql',
      })
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to export audit logs',
      message: error?.message || 'Unknown error occurred',
    })
  }
})
