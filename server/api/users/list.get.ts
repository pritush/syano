import { defineEventHandler } from 'h3'
import { desc } from 'drizzle-orm'
import { requirePermission } from '~/server/utils/auth'
import { useDrizzle } from '~/server/utils/db'
import { users } from '~/server/database/schema'
import { PERMISSIONS } from '~/shared/permissions'

export default defineEventHandler(async (event) => {
  await requirePermission(event, PERMISSIONS.USERS_MANAGE)

  const db = await useDrizzle(event)
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.display_name,
      permissions: users.permissions,
      isActive: users.is_active,
      createdAt: users.created_at,
      updatedAt: users.updated_at,
    })
    .from(users)
    .orderBy(desc(users.created_at))

  return rows
})
