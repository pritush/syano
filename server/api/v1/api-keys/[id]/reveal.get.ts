import { defineEventHandler, createError } from 'h3'
import { eq, and, isNull } from 'drizzle-orm'
import { useDrizzle } from '~/server/utils/db'
import { api_keys } from '~/server/database/schema'
import { decrypt } from '~/server/utils/encryption'
import { requirePermission } from '~/server/utils/auth'
import { PERMISSIONS } from '~/shared/permissions'

/**
 * Reveal the full API key
 * GET /api/v1/api-keys/:id/reveal
 * Requires API_MANAGE permission
 */
export default defineEventHandler(async (event) => {
  const user = await requirePermission(event, PERMISSIONS.API_MANAGE)
  const db = await useDrizzle(event)
  const id = event.context.params?.id
  
  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'API key ID is required',
    })
  }
  
  // Root user's keys have user_id = null
  const userFilter = user.isRoot
    ? isNull(api_keys.user_id)
    : eq(api_keys.user_id, user.id)
  
  // Find the API key
  const [apiKey] = await db
    .select({
      id: api_keys.id,
      name: api_keys.name,
      key_encrypted: api_keys.key_encrypted,
    })
    .from(api_keys)
    .where(and(eq(api_keys.id, id), userFilter))
    .limit(1)
  
  if (!apiKey) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'API key not found',
    })
  }
  
  if (!apiKey.key_encrypted) {
    throw createError({
      statusCode: 410,
      statusMessage: 'Gone',
      message: 'This API key was created before encryption was enabled and cannot be retrieved. Please create a new API key.',
    })
  }
  
  try {
    // Decrypt the API key
    const decryptedKey = decrypt(apiKey.key_encrypted)
    
    return {
      success: true,
      data: {
        id: apiKey.id,
        name: apiKey.name,
        key: decryptedKey,
      },
    }
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Failed to decrypt API key',
    })
  }
})
