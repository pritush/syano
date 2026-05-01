import { createError, defineEventHandler, getQuery } from 'h3'
import { analyticsQuerySchema } from '~/shared/schemas/analytics'
import { getAnalyticsMetrics } from '~/server/utils/analytics'
import { requireUnifiedAuth, requireUnifiedPermission } from '~/server/utils/unified-auth'
import { checkRateLimit } from '~/server/utils/rate-limit'

/**
 * Get detailed analytics metrics
 * GET /api/v1/analytics/metrics
 * 
 * Authentication: Supports both JWT tokens (dashboard) and API keys (external)
 */
export default defineEventHandler(async (event) => {
  const auth = await requireUnifiedAuth(event)
  requireUnifiedPermission(auth, 'analytics:read')
  
  // Rate limit (only for API key requests)
  if (auth.type === 'apikey') {
    await checkRateLimit(event, {
      id: auth.apiKeyId!,
      user_id: auth.userId,
      name: auth.apiKeyName!,
      permissions: auth.permissions,
      key_prefix: auth.apiKeyPrefix!
    }, '/api/v1/analytics')
  }
  
  const parsed = analyticsQuerySchema.safeParse(getQuery(event))

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Invalid analytics query',
      data: parsed.error.errors,
    })
  }

  const data = await getAnalyticsMetrics(event, parsed.data)

  return {
    success: true,
    data,
  }
})
