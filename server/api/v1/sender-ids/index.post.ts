import { defineEventHandler, readBody, createError } from 'h3'
import { eq, ne } from 'drizzle-orm'
import { requireUnifiedAuth, requireUnifiedPermission } from '~/server/utils/unified-auth'
import { useDrizzle } from '~/server/utils/db'
import { sender_ids } from '~/server/database/schema'
import { createSenderIdSchema } from '~/shared/schemas/sender-id'
import { recordAudit } from '~/server/utils/audit-log'

/**
 * Create a new sender ID
 * POST /api/v1/sender-ids
 */
export default defineEventHandler(async (event) => {
  const auth = await requireUnifiedAuth(event)
  requireUnifiedPermission(auth, 'settings:manage')

  const body = await readBody(event)
  const validation = createSenderIdSchema.safeParse(body)

  if (!validation.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Validation failed',
      data: validation.error.errors,
    })
  }

  const db = await useDrizzle(event)
  const { name, description, is_default } = validation.data

  // Check for duplicate name
  const existing = await db.query.sender_ids.findFirst({
    where: eq(sender_ids.name, name),
  })

  if (existing) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Conflict',
      message: `Sender ID '${name}' already exists`,
    })
  }

  const [created] = await db
    .insert(sender_ids)
    .values({
      name,
      description,
      is_default: is_default ?? false,
    })
    .returning()

  // If this is set as default, unset others
  if (created && created.is_default) {
    await db.update(sender_ids)
      .set({ is_default: false })
      .where(ne(sender_ids.id, created.id))
  }

  if (!created) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create sender ID',
    })
  }

  recordAudit(event, {
    actor: auth,
    action: 'create',
    entityType: 'sender_id',
    entityId: created.id,
    entityLabel: created.name,
    details: { name, description },
  })

  return {
    success: true,
    data: created,
  }
})
