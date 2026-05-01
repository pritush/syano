import { createError, defineEventHandler, getQuery } from 'h3'
import { searchLinksQuerySchema } from '~/shared/schemas/link'
import { searchLinks } from '~/server/utils/link-store'
import { requireUnifiedAuth, requireUnifiedPermission } from '~/server/utils/unified-auth'
import { checkRateLimit } from '~/server/utils/rate-limit'

/**
 * Search links by query
 * GET /api/v1/links/search
 * 
 * Authentication: Supports both JWT tokens (dashboard) and API keys (external)
 */
export default defineEventHandler(async (event) => {
  const auth = await requireUnifiedAuth(event)
  requireUnifiedPermission(auth, 'links:read')
  
  // Rate limit (only for API key requests)
  if (auth.type === 'apikey') {
    await checkRateLimit(event, {
      id: auth.apiKeyId!,
      user_id: auth.userId,
      name: auth.apiKeyName!,
      permissions: auth.permissions,
      key_prefix: auth.apiKeyPrefix!
    }, '/api/v1/links/search')
  }
  
  const query = getQuery(event)
  const parsed = searchLinksQuerySchema.safeParse(query)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Invalid query parameters',
      data: parsed.error.errors,
    })
  }

  const results = await searchLinks(event, parsed.data.q, parsed.data.limit)

  return {
    success: true,
    data: results,
  }
})
