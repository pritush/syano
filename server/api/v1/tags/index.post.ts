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
  console.log('[Tag Creation] Starting tag creation request')
  
  const auth = await requireUnifiedAuth(event)
  console.log('[Tag Creation] Auth successful, user:', auth.userId, 'type:', auth.type)
  
  requireUnifiedPermission(auth, 'tags:manage')
  console.log('[Tag Creation] Permission check passed')
  
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
  console.log('[Tag Creation] Request body:', body)
  
  const validation = createTagSchema.safeParse(body)
  
  if (!validation.success) {
    console.error('[Tag Creation] Validation failed:', validation.error.errors)
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Validation failed',
      data: validation.error.errors,
    })
  }
  
  const data = validation.data
  console.log('[Tag Creation] Validated data:', data)
  
  const db = await useDrizzle(event)
  console.log('[Tag Creation] Database connection acquired')
  
  // Check if tag name already exists
  const [existing] = await db
    .select()
    .from(tags)
    .where(eq(tags.name, data.name))
    .limit(1)
  
  if (existing) {
    console.log('[Tag Creation] Tag already exists:', existing.name)
    throw createError({
      statusCode: 409,
      statusMessage: 'Conflict',
      message: `Tag '${data.name}' already exists`,
    })
  }
  
  console.log('[Tag Creation] Tag name is unique, inserting...')
  
  // Create tag
  const tagId = crypto.randomUUID()
  console.log('[Tag Creation] Generated tag ID:', tagId)
  
  const insertedTags = await db
    .insert(tags)
    .values({
      id: tagId,
      name: data.name,
    })
    .returning()

  console.log('[Tag Creation] Insert result:', insertedTags)
  
  const tag = insertedTags[0]

  if (!tag) {
    console.error('[Tag Creation] No tag returned after insert')
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create tag',
    })
  }
  
  console.log('[Tag Creation] Tag created successfully:', tag)
  
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
