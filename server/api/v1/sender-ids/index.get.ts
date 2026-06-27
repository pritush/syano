import { defineEventHandler } from 'h3'
import { desc } from 'drizzle-orm'
import { requireUnifiedAuth, requireUnifiedPermission } from '~/server/utils/unified-auth'
import { useDrizzle } from '~/server/utils/db'
import { sender_ids } from '~/server/database/schema'

/**
 * List all sender IDs
 * GET /api/v1/sender-ids
 */
export default defineEventHandler(async (event) => {
  const auth = await requireUnifiedAuth(event)
  requireUnifiedPermission(auth, 'settings:manage')

  const db = await useDrizzle(event)

  const items = await db.query.sender_ids.findMany({
    orderBy: [desc(sender_ids.created_at)],
  })

  return {
    success: true,
    data: items,
  }
})
