import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { and, eq, ne } from 'drizzle-orm'
import { z } from 'zod'
import { tags } from '~/server/database/schema'
import { useDrizzle } from '~/server/utils/db'
import { requireUnifiedAuth, requireUnifiedPermission } from '~/server/utils/unified-auth'
import { checkRateLimit } from '~/server/utils/rate-limit'
import { invalidateTagsCache } from '~/server/utils/cache'
import { recordAudit } from '~/server/utils/audit-log'

const updateTagSchema = z.object({
  name: z.string().trim().min(1).max(120),
})

/**
 * Update a tag
 * PATCH /api/v1/tags/:id
 *
 * Authentication: Supports both JWT tokens (dashboard) and API keys (external)
 */
export default defineEventHandler(async (event) => {
  const auth = await requireUnifiedAuth(event)
  requireUnifiedPermission(auth, 'tags:manage')

  if (auth.type === 'apikey') {
    await checkRateLimit(event, {
      id: auth.apiKeyId!,
      user_id: auth.userId,
      name: auth.apiKeyName!,
      permissions: auth.permissions,
      key_prefix: auth.apiKeyPrefix!,
    }, '/api/v1/tags')
  }

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing tag ID parameter',
    })
  }

  const body = await readBody(event)
  const validation = updateTagSchema.safeParse(body)

  if (!validation.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Validation failed',
      data: validation.error.errors,
    })
  }

  const db = await useDrizzle(event)
  const existing = await db.query.tags.findFirst({
    where: eq(tags.id, id),
  })

  if (!existing) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Tag not found',
    })
  }

  const name = validation.data.name
  const duplicate = await db.query.tags.findFirst({
    where: and(eq(tags.name, name), ne(tags.id, id)),
  })

  if (duplicate) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Conflict',
      message: `Tag '${name}' already exists`,
    })
  }

  const [updated] = await db
    .update(tags)
    .set({ name })
    .where(eq(tags.id, id))
    .returning()

  if (!updated) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update tag',
    })
  }

  invalidateTagsCache()

  recordAudit(event, {
    actor: {
      id: auth.userId,
      username: auth.username || 'api-key',
      displayName: auth.displayName || auth.apiKeyName || 'API Key',
      permissions: auth.permissions,
      isRoot: auth.isRoot || false,
    },
    action: 'update',
    entityType: 'tag',
    entityId: updated.id,
    entityLabel: updated.name,
    details: { previous_name: existing.name, name: updated.name },
  })

  return {
    success: true,
    data: {
      id: updated.id,
      name: updated.name,
      color: '#3B82F6',
      created_at: updated.created_at,
    },
  }
})
