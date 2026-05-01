import { defineEventHandler, setHeader } from 'h3'
import { exportLinks } from '~/server/utils/link-store'
import { requireUnifiedAuth, requireUnifiedPermission } from '~/server/utils/unified-auth'
import { checkRateLimit } from '~/server/utils/rate-limit'

/**
 * Export all links
 * GET /api/v1/links/export
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
    }, '/api/v1/links/export')
  }
  
  setHeader(event, 'content-type', 'application/json; charset=utf-8')

  const items = await exportLinks(event)

  return {
    success: true,
    data: {
      exported_at: new Date().toISOString(),
      count: items.length,
      items,
    },
  }
})
