import { defineEventHandler, readBody, createError } from 'h3'
import { useRuntimeConfig } from '#imports'
import { requireUnifiedAuth, requireUnifiedPermission } from '~/server/utils/unified-auth'
import { checkRateLimit } from '~/server/utils/rate-limit'
import { buildShortLink, createLink, getLink } from '~/server/utils/link-store'
import { createLinkSchema } from '~/shared/schemas/link'
import { z } from 'zod'

/**
 * Bulk create short links
 * POST /api/v1/links/bulk
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
    }, '/api/v1/links/bulk')
  }
  
  const runtimeConfig = useRuntimeConfig(event)
  const bulkCreateSchema = z.object({
    links: z.array(createLinkSchema(runtimeConfig.public.slugDefaultLength)).min(1).max(100),
  })
  const body = await readBody(event)
  const validation = bulkCreateSchema.safeParse(body)
  
  if (!validation.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Validation failed',
      data: validation.error.errors,
    })
  }
  
  const { links: linksToCreate } = validation.data
  
  const results: Array<{ success: boolean; data?: any; error?: string }> = []
  
  // Process each link
  for (const linkData of linksToCreate) {
    try {
      if (linkData.slug && await getLink(event, linkData.slug)) {
        results.push({
          success: false,
          error: `Slug '${linkData.slug}' is already in use`,
        })
        continue
      }
      
      const link = await createLink(event, linkData)
      
      results.push({
        success: true,
        data: {
          id: link.id,
          slug: link.slug,
          url: link.url,
          short_url: buildShortLink(event, link.slug),
          title: link.title,
          description: link.description,
          comment: link.comment,
          tag_id: link.tag_id,
          expiration: link.expiration,
          cloaking: link.cloaking,
          redirect_with_query: link.redirect_with_query,
          created_at: link.created_at,
          updated_at: link.updated_at,
        },
      })
    } catch (error: any) {
      results.push({
        success: false,
        error: error.message || 'Unknown error',
      })
    }
  }
  
  const successCount = results.filter(r => r.success).length
  const failureCount = results.filter(r => !r.success).length
  
  return {
    success: true,
    summary: {
      total: results.length,
      successful: successCount,
      failed: failureCount,
    },
    results,
  }
})
