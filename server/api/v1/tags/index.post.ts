import { defineEventHandler, readBody, createError } from 'h3'
import { eq } from 'drizzle-orm'
import crypto from 'node:crypto'
import { useDrizzle } from '~/server/utils/db'
import { tags } from '~/server/database/schema'
import { requireUnifiedAuth, requireUnifiedPermission } from '~/server/utils/unified-auth'
import { checkRateLimit } from '~/server/utils/rate-limit'
import { z } from 'zod'

const createTagSchema = z.object({
  name: z.string().min(1).max(64),
})

/**
 * Create a new tag
 * POST /api/v1/tags
 * 
 * Authentication: Supports both JWT tokens (dashboard) and API keys (external)
 */
export default defineEventHandler(async (event) => {
  const auth = await requireUnifiedAuth(event)
  requireUnifiedPermission(auth, 'tags:manage')
  
  // Rate limit (only for API key requests)
  if (auth.type === 'apikey') {
    await checkRateLimit(event, {
      id: auth.apiKeyId!,
      user_id: auth.userId,
      name: auth.apiKeyName!,
      permissions: auth.permissions,
      key_prefix: auth.apiKeyPrefix!
    }, '/api/v1/tags')
  }
  
  const body = await readBody(event)
  const validation = createTagSchema.safeParse(body)
  
  if (!validation.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Validation failed',
      data: validation.error.errors,
    })
  }
  
  const data = validation.data
  const db = await useDrizzle(event)
  
  // Check if tag name already exists
  const [existing] = await db
    .select()
    .from(tags)
    .where(eq(tags.name, data.name))
    .limit(1)
  
  if (existing) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Conflict',
      message: `Tag '${data.name}' already exists`,
    })
  }
  
  // Create tag
  const [tag] = await db
    .insert(tags)
    .values({
      id: crypto.randomUUID(),
      name: data.name,
    })
    .returning()

  if (!tag) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create tag',
    })
  }
  
  return {
    success: true,
    data: {
      id: tag.id,
      name: tag.name,
      color: '#3B82F6',
      created_at: tag.created_at,
    },
  }
})
