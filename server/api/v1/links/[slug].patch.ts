import { defineEventHandler, getRouterParam, readBody, createError, getRequestURL } from 'h3'
import { eq } from 'drizzle-orm'
import { useDrizzle } from '~/server/utils/db'
import { links } from '~/server/database/schema'
import { requireUnifiedAuth, requireUnifiedPermission } from '~/server/utils/unified-auth'
import { checkRateLimit } from '~/server/utils/rate-limit'
import { z } from 'zod'

const updateLinkSchema = z.object({
  url: z.string().url('Invalid URL format').optional(),
  title: z.string().max(256).optional(),
  description: z.string().max(1000).optional(),
  comment: z.string().max(1000).optional(),
  tag_id: z.string().max(64).nullable().optional(),
  expiration: z.number().int().positive().nullable().optional(),
  password: z.string().min(4).max(128).nullable().optional(),
  cloaking: z.boolean().optional(),
  redirect_with_query: z.boolean().optional(),
})

/**
 * Update a link
 * PATCH /api/v1/links/:slug
 * 
 * Authentication: Supports both JWT tokens (dashboard) and API keys (external)
 */
export default defineEventHandler(async (event) => {
  const auth = await requireUnifiedAuth(event)
  requireUnifiedPermission(auth, 'links:edit')
  
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
  
  const body = await readBody(event)
  const validation = updateLinkSchema.safeParse(body)
  
  if (!validation.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Validation failed',
      data: validation.error.errors,
    })
  }
  
  const data = validation.data
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
  
  // Update link
  const [updated] = await db
    .update(links)
    .set({
      ...data,
      updated_at: new Date(),
    })
    .where(eq(links.slug, slug))
    .returning()

  if (!updated) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update link',
    })
  }
  
  return {
    success: true,
    data: {
      id: updated.id,
      slug: updated.slug,
      url: updated.url,
      short_url: `${getRequestURL(event).origin}/${updated.slug}`,
      title: updated.title,
      description: updated.description,
      comment: updated.comment,
      tag_id: updated.tag_id,
      expiration: updated.expiration,
      cloaking: updated.cloaking,
      redirect_with_query: updated.redirect_with_query,
      created_at: updated.created_at,
      updated_at: updated.updated_at,
    },
  }
})
