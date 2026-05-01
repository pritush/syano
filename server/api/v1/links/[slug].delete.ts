import { defineEventHandler, getRouterParam, createError } from 'h3'
import { eq } from 'drizzle-orm'
import { useDrizzle } from '~/server/utils/db'
import { links } from '~/server/database/schema'
import { requireUnifiedAuth, requireUnifiedPermission } from '~/server/utils/unified-auth'
import { checkRateLimit } from '~/server/utils/rate-limit'

/**
 * Delete a link
 * DELETE /api/v1/links/:slug
 * 
 * Authentication: Supports both JWT tokens (dashboard) and API keys (external)
 */
export default defineEventHandler(async (event) => {
  const auth = await requireUnifiedAuth(event)
  requireUnifiedPermission(auth, 'links:delete')
  
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
  
  // Check if link exists
  const [existing] = await db
    .select()
    .from(links)
    .where(eq(links.slug, slug))
    .limit(1)
  
  if (!existing) {
    throw createError({
      statusCode: 404,
      message: `Link with slug '${slug}' not found`,
    })
  }
  
  // Delete link
  await db
    .delete(links)
    .where(eq(links.slug, slug))
  
  return {
    success: true,
    message: `Link '${slug}' deleted successfully`,
  }
})
