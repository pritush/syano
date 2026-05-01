import { defineEventHandler, readBody, createError } from 'h3'
import { useDrizzle } from '~/server/utils/db'
import { api_keys } from '~/server/database/schema'
import { generateApiKey } from '~/server/utils/api-auth'
import { encrypt } from '~/server/utils/encryption'
import { requirePermission } from '~/server/utils/auth'
import { PERMISSIONS } from '~/shared/permissions'
import { z } from 'zod'

const createApiKeySchema = z.object({
  name: z.string().min(1).max(128),
  permissions: z.array(z.string()).min(1),
  expires_in_days: z.preprocess(
    (val) => (val === null || val === '' || val === undefined ? undefined : Number(val)),
    z.number().int().positive().max(365).optional(),
  ),
})

/**
 * Create a new API key
 * POST /api/v1/api-keys
 * Requires API_MANAGE permission
 */
export default defineEventHandler(async (event) => {
  const user = await requirePermission(event, PERMISSIONS.API_MANAGE)
  const body = await readBody(event)
  
  const validation = createApiKeySchema.safeParse(body)
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
  
  // Generate API key
  const { key, prefix, hash } = generateApiKey()
  
  // Encrypt the full key for storage
  const encryptedKey = encrypt(key)
  
  // Calculate expiration date
  const expiresAt = data.expires_in_days
    ? new Date(Date.now() + data.expires_in_days * 24 * 60 * 60 * 1000)
    : null
  
  // Resolve user_id: root user doesn't have a DB record, so store null
  const userId = user.isRoot ? null : user.id
  
  // Create API key record
  const [apiKey] = await db
    .insert(api_keys)
    .values({
      user_id: userId,
      name: data.name,
      key_prefix: prefix,
      key_hash: hash,
      key_encrypted: encryptedKey,
      permissions: data.permissions,
      expires_at: expiresAt,
      is_active: true,
    })
    .returning()

  if (!apiKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create API key',
    })
  }
  
  return {
    success: true,
    message: 'API key created successfully. Make sure to copy it now - you won\'t be able to see it again!',
    data: {
      id: apiKey.id,
      name: apiKey.name,
      key, // Only returned once!
      key_prefix: apiKey.key_prefix,
      permissions: apiKey.permissions,
      expires_at: apiKey.expires_at,
      created_at: apiKey.created_at,
    },
  }
})
