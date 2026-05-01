import { createError, defineEventHandler, readBody } from 'h3'
import { useRuntimeConfig } from '#imports'
import { createImportLinksSchema } from '~/shared/schemas/import-export'
import { importLinks } from '~/server/utils/link-store'
import { requireUnifiedAuth, requireUnifiedPermission } from '~/server/utils/unified-auth'
import { checkRateLimit } from '~/server/utils/rate-limit'

/**
 * Import links from JSON
 * POST /api/v1/links/import
 * 
 * Authentication: Supports both JWT tokens (dashboard) and API keys (external)
 */
export default defineEventHandler(async (event) => {
  const auth = await requireUnifiedAuth(event)
  requireUnifiedPermission(auth, 'links:create')
  
  // Rate limit (only for API key requests)
  if (auth.type === 'apikey') {
    await checkRateLimit(event, {
      id: auth.apiKeyId!,
      user_id: auth.userId,
      name: auth.apiKeyName!,
      permissions: auth.permissions,
      key_prefix: auth.apiKeyPrefix!
    }, '/api/v1/links/import')
  }
  
  const runtimeConfig = useRuntimeConfig(event)
  const body = await readBody(event)
  const parsed = createImportLinksSchema(runtimeConfig.public.slugDefaultLength).safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Invalid import payload',
      data: parsed.error.errors,
    })
  }

  const imported = await importLinks(event, parsed.data.items, parsed.data.overwrite)

  return {
    success: true,
    data: {
      count: imported.length,
      items: imported,
    },
  }
})
