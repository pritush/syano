import { defineEventHandler, readBody, createError } from 'h3'
import { requireUnifiedAuth, requireUnifiedPermission } from '~/server/utils/unified-auth'
import { checkRateLimit } from '~/server/utils/rate-limit'
import { createTagSchema } from '~/shared/schemas/tag'
import { createTag } from '~/server/utils/tags'
import { recordAudit } from '~/server/utils/audit-log'

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
  
  // Use the utility function which handles cache invalidation
  try {
    console.log('[Tag Creation] Calling createTag utility...')
    const tag = await createTag(event, data.name)
    
    if (!tag) {
      console.error('[Tag Creation] No tag returned from createTag utility')
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to create tag',
      })
    }
    
    console.log('[Tag Creation] Tag created successfully:', tag)
    
    // Record audit log
    await recordAudit(event, {
      user_id: auth.userId,
      action: 'tag.create',
      resource_type: 'tag',
      resource_id: tag.id,
      details: { name: tag.name },
    })
    
    return {
      success: true,
      data: {
        id: tag.id,
        name: tag.name,
        color: '#3B82F6',
        created_at: tag.created_at,
      },
    }
  } catch (error: any) {
    console.error('[Tag Creation] Error:', error)
    
    // Check for duplicate error (PostgreSQL unique constraint violation)
    if (error.code === '23505' || error.message?.includes('duplicate') || error.message?.includes('unique')) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Conflict',
        message: `Tag '${data.name}' already exists`,
      })
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create tag',
      message: error.message || 'Unknown error',
    })
  }
})
