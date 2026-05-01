import { createError, defineEventHandler, readBody, getRouterParam } from 'h3'
import { eq } from 'drizzle-orm'
import { requirePermission, hashPassword, findUserById } from '~/server/utils/auth'
import { useDrizzle } from '~/server/utils/db'
import { users } from '~/server/database/schema'
import { updateUserSchema } from '~/shared/schemas/user'
import { PERMISSIONS } from '~/shared/permissions'
import { recordAudit } from '~/server/utils/audit-log'

export default defineEventHandler(async (event) => {
  const actor = await requirePermission(event, PERMISSIONS.USERS_MANAGE)

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'User ID is required' })
  }

  const existing = await findUserById(event, id)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  const body = await readBody(event)
  const parsed = updateUserSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.flatten().fieldErrors
        ? Object.values(parsed.error.flatten().fieldErrors).flat().join(', ')
        : 'Invalid update payload',
    })
  }

  const updates: Record<string, any> = {
    updated_at: new Date(),
  }

  if (parsed.data.displayName !== undefined) {
    updates.display_name = parsed.data.displayName || null
  }

  if (parsed.data.permissions !== undefined) {
    updates.permissions = parsed.data.permissions as string[]
  }

  if (parsed.data.isActive !== undefined) {
    updates.is_active = parsed.data.isActive
  }

  if (parsed.data.password) {
    updates.password_hash = await hashPassword(parsed.data.password)
  }

  const db = await useDrizzle(event)
  const [updated] = await db
    .update(users)
    .set(updates)
    .where(eq(users.id, id))
    .returning({
      id: users.id,
      username: users.username,
      displayName: users.display_name,
      permissions: users.permissions,
      isActive: users.is_active,
      createdAt: users.created_at,
      updatedAt: users.updated_at,
    })

  if (!updated) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update user',
    })
  }

  // Build a summary of what changed for the audit details
  const changedFields: string[] = []
  if (parsed.data.displayName !== undefined) changedFields.push('displayName')
  if (parsed.data.permissions !== undefined) changedFields.push('permissions')
  if (parsed.data.isActive !== undefined) changedFields.push('isActive')
  if (parsed.data.password) changedFields.push('password')

  recordAudit(event, {
    actor,
    action: 'update',
    entityType: 'user',
    entityId: updated.id,
    entityLabel: updated.username,
    details: { changedFields },
  })

  return updated
})
