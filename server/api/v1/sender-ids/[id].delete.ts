import { defineEventHandler, createError, getRouterParam } from 'h3'
import { eq, sql } from 'drizzle-orm'
import { requireUnifiedAuth, requireUnifiedPermission } from '~/server/utils/unified-auth'
import { useDrizzle } from '~/server/utils/db'
import { sender_ids, links } from '~/server/database/schema'
import { recordAudit } from '~/server/utils/audit-log'

/**
 * Delete a sender ID
 * DELETE /api/v1/sender-ids/:id
 */
export default defineEventHandler(async (event) => {
  const auth = await requireUnifiedAuth(event)
  requireUnifiedPermission(auth, 'settings:manage')

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing sender ID parameter',
    })
  }

  const db = await useDrizzle(event)

  // Check if sender ID exists
  const existing = await db.query.sender_ids.findFirst({
    where: eq(sender_ids.id, id),
  })

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Sender ID not found',
    })
  }

  // Check if any links reference this sender ID
  const linkedCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(links)
    .where(eq(links.sender_id, id))

  const count = linkedCount[0]?.count || 0
  if (count > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Conflict',
      message: `Cannot delete sender ID '${existing.name}' — it is referenced by ${count} link(s). Remove the sender ID from those links first, or deactivate it instead.`,
    })
  }

  const [deleted] = await db
    .delete(sender_ids)
    .where(eq(sender_ids.id, id))
    .returning()

  recordAudit(event, {
    actor: auth,
    action: 'delete',
    entityType: 'sender_id',
    entityId: existing.id,
    entityLabel: existing.name,
  })

  return {
    success: true,
    message: `Sender ID '${deleted?.name || id}' has been deleted`,
  }
})
