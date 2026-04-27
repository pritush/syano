import { createError, defineEventHandler, getRouterParam } from 'h3'
import { eq } from 'drizzle-orm'
import { requirePermission, findUserById } from '~/server/utils/auth'
import { useDrizzle } from '~/server/utils/db'
import { users } from '~/server/database/schema'
import { PERMISSIONS } from '~/shared/permissions'
import type { AuthUser } from '~/server/utils/auth'
import { recordAudit } from '~/server/utils/audit-log'

export default defineEventHandler(async (event) => {
  const authUser = await requirePermission(event, PERMISSIONS.USERS_MANAGE) as AuthUser

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'User ID is required' })
  }

  // Cannot delete yourself
  if (authUser.id === id) {
    throw createError({ statusCode: 400, statusMessage: 'You cannot delete your own account' })
  }

  const existing = await findUserById(event, id)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  const db = await useDrizzle(event)
  await db.delete(users).where(eq(users.id, id))

  recordAudit(event, {
    actor: authUser,
    action: 'delete',
    entityType: 'user',
    entityId: existing.id,
    entityLabel: existing.username,
  })

  return { ok: true, username: existing.username }
})
