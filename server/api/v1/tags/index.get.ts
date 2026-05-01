import { createError, defineEventHandler, getQuery } from 'h3'
import { requireUnifiedAuth, hasUnifiedPermission } from '~/server/utils/unified-auth'
import { checkRateLimit } from '~/server/utils/rate-limit'
import { listTagsWithCounts } from '~/server/utils/tags'

/**
 * List tags with link counts
 * GET /api/v1/tags
 * 
 * Authentication: Supports both JWT tokens (dashboard) and API keys (external)
 */
export default defineEventHandler(async (event) => {
  const auth = await requireUnifiedAuth(event)

  const canReadTags =
    hasUnifiedPermission(auth, 'tags:manage') ||
    hasUnifiedPermission(auth, 'links:read') ||
    hasUnifiedPermission(auth, 'analytics:read')

  if (!canReadTags) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden: requires tag, link, or analytics access',
    })
  }
  
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

  const query = getQuery(event)
  const search = ((query.search as string) || '').trim().toLowerCase()
  const results = await listTagsWithCounts(event)
  const filtered = search
    ? results.filter((tag) => tag.name.toLowerCase().includes(search))
    : results
  
  return {
    success: true,
    data: filtered.map((tag) => ({
      ...tag,
      color: '#3B82F6',
    })),
  }
})
