import { defineEventHandler, getRouterParam, createError } from 'h3'
import { eq, and, isNull } from 'drizzle-orm'
import { useDrizzle } from '~/server/utils/db'
import { api_keys } from '~/server/database/schema'
import { requirePermission } from '~/server/utils/auth'
import { PERMISSIONS } from '~/shared/permissions'

/**
 * Revoke (delete) an API key
 * DELETE /api/v1/api-keys/:id
 * Requires API_MANAGE permission
 */
export default defineEventHandler(async (event) => {
  const user = await requirePermission(event, PERMISSIONS.API_MANAGE)
  const id = getRouterParam(event, 'id')
  
  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'API key ID is required',
    })
  }
  
  const db = await useDrizzle(event)
  
  // Root user's keys have user_id = null
  const ownerFilter = user.isRoot
    ? isNull(api_keys.user_id)
    : eq(api_keys.user_id, user.id)
  
  // Check if API key exists and belongs to user
  const [existing] = await db
    .select()
    .from(api_keys)
    .where(
      and(
        eq(api_keys.id, id),
        ownerFilter
      )
    )
    .limit(1)
  
  if (!existing) {
    throw createError({
      statusCode: 404,
      message: 'API key not found',
    })
  }
  
  // Delete API key
  await db
    .delete(api_keys)
    .where(eq(api_keys.id, id))
  
  return {
    success: true,
    message: 'API key revoked successfully',
  }
})
