import { defineEventHandler, getQuery, createError } from 'h3'
import { desc, and, eq, gte, lte, ilike, or, sql } from 'drizzle-orm'
import { requireAuth } from '~/server/utils/auth'
import { useDrizzle } from '~/server/utils/db'
import { audit_logs } from '~/server/database/schema'

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)

    // Only super admin (root) can view audit logs
    if (!user.isRoot) {
      throw createError({ statusCode: 403, statusMessage: 'Forbidden: super admin only' })
    }

    const query = getQuery(event)
    const limit = Math.min(Number(query.limit) || 50, 200)
    const offset = Math.max(Number(query.offset) || 0, 0)
    const action = (query.action as string) || ''
    const entityType = (query.entity_type as string) || ''
    const search = (query.search as string) || ''
    const dateFrom = (query.date_from as string) || ''
    const dateTo = (query.date_to as string) || ''

    const db = await useDrizzle(event)
    const filters = []

  if (action) {
    filters.push(eq(audit_logs.action, action))
  }

  if (entityType) {
    filters.push(eq(audit_logs.entity_type, entityType))
  }

  if (search) {
    const q = `%${search}%`
    filters.push(
      or(
        ilike(audit_logs.actor_username, q),
        ilike(audit_logs.entity_label, q),
        ilike(audit_logs.entity_id, q),
      )!,
    )
  }

  if (dateFrom) {
    filters.push(gte(audit_logs.created_at, new Date(dateFrom)))
  }

  if (dateTo) {
    // Add 1 day to include the entire end date
    const endDate = new Date(dateTo)
    endDate.setDate(endDate.getDate() + 1)
    filters.push(lte(audit_logs.created_at, endDate))
  }

    const where = filters.length ? and(...filters) : undefined

    const [items, countResult] = await Promise.all([
      db
        .select()
        .from(audit_logs)
        .where(where)
        .orderBy(desc(audit_logs.created_at))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(audit_logs)
        .where(where),
    ])

    return {
      items,
      total: countResult[0]?.count ?? 0,
      limit,
      offset,
    }
  } catch (error: any) {
    console.error('[Audit Logs] Error fetching audit logs:', error)
    
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
      statusMessage: 'Failed to fetch audit logs',
      message: error?.message || 'Unknown error occurred',
    })
  }
})
