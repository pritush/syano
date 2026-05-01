import { defineEventHandler, getRouterParam, createError, getRequestURL } from 'h3'
import { eq } from 'drizzle-orm'
import { useDrizzle } from '~/server/utils/db'
import { links } from '~/server/database/schema'
import { requireUnifiedAuth, requireUnifiedPermission } from '~/server/utils/unified-auth'
import { checkRateLimit } from '~/server/utils/rate-limit'

/**
 * Get a specific link by slug
 * GET /api/v1/links/:slug
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
    }, '/api/v1/links')
  }
  
  const slug = getRouterParam(event, 'slug')
  if (!slug) {
    throw createError({
      statusCode: 400,
      message: 'Slug parameter is required',
    })
  }
  
  const db = await useDrizzle(event)
  const [link] = await db
    .select()
    .from(links)
    .where(eq(links.slug, slug))
    .limit(1)
  
  if (!link) {
    throw createError({
      statusCode: 404,
      message: `Link with slug '${slug}' not found`,
    })
  }
  
  return {
    success: true,
    data: {
      id: link.id,
      slug: link.slug,
      url: link.url,
      short_url: `${getRequestURL(event).origin}/${link.slug}`,
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
  }
})
