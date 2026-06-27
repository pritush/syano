import { defineEventHandler, readBody, createError, getRouterParam } from 'h3'
import { eq, ne } from 'drizzle-orm'
import { requireUnifiedAuth, requireUnifiedPermission } from '~/server/utils/unified-auth'
import { useDrizzle } from '~/server/utils/db'
import { sender_ids } from '~/server/database/schema'
import { updateSenderIdSchema } from '~/shared/schemas/sender-id'
import { recordAudit } from '~/server/utils/audit-log'

/**
 * Update a sender ID
 * PATCH /api/v1/sender-ids/:id
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

  const body = await readBody(event)
  const validation = updateSenderIdSchema.safeParse(body)

  if (!validation.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Validation failed',
      data: validation.error.errors,
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

  // If renaming, check for duplicates
  if (validation.data.name && validation.data.name !== existing.name) {
    const duplicate = await db.query.sender_ids.findFirst({
      where: eq(sender_ids.name, validation.data.name),
    })

    if (duplicate) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Conflict',
        message: `Sender ID '${validation.data.name}' already exists`,
      })
    }
  }

  const updateData: Record<string, any> = {}
  if (validation.data.name !== undefined) updateData.name = validation.data.name
  if (validation.data.description !== undefined) updateData.description = validation.data.description
  if (validation.data.is_active !== undefined) updateData.is_active = validation.data.is_active
  if (validation.data.is_default !== undefined) updateData.is_default = validation.data.is_default

  const [updated] = await db
    .update(sender_ids)
    .set(updateData)
    .where(eq(sender_ids.id, id))
    .returning()

  // If this is set as default, unset others
  if (updated && updated.is_default) {
    await db.update(sender_ids)
      .set({ is_default: false })
      .where(ne(sender_ids.id, updated.id))
  }

  if (!updated) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update sender ID',
    })
  }

  recordAudit(event, {
    actor: auth,
    action: 'update',
    entityType: 'sender_id',
    entityId: updated.id,
    entityLabel: updated.name,
    details: updateData,
  })

  return {
    success: true,
    data: updated,
  }
})
