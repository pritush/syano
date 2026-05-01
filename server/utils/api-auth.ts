import type { H3Event } from 'h3'
import { createError, getHeader } from 'h3'
import { eq, and, gt } from 'drizzle-orm'
import { useDrizzle } from '~/server/utils/db'
import { api_keys } from '~/server/database/schema'
import { AuthErrors, AuthzErrors } from '~/server/utils/api-errors'
import { apiLogger } from '~/server/utils/api-logger'
import crypto from 'node:crypto'

export interface ApiKeyData {
  id: string
  user_id: string
  name: string
  permissions: string[]
  key_prefix: string
  is_root?: boolean
}

/**
 * Hash an API key for secure storage
 */
export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex')
}

/**
 * Generate a new API key
 * Format: sk_live_[32 random chars]
 */
export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const randomBytes = crypto.randomBytes(24).toString('base64url')
  const key = `sk_live_${randomBytes}`
  const prefix = key.substring(0, 16) // sk_live_XXXXXXXX
  const hash = hashApiKey(key)
  
  return { key, prefix, hash }
}

/**
 * Extract API key from request headers
 */
function extractApiKey(event: H3Event): string | null {
  // Check Authorization header: Bearer sk_live_...
  const authHeader = getHeader(event, 'authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }
  
  // Check X-API-Key header
  const apiKeyHeader = getHeader(event, 'x-api-key')
  if (apiKeyHeader) {
    return apiKeyHeader
  }
  
  return null
}

/**
 * Authenticate API request and return API key data
 */
export async function requireApiKey(event: H3Event): Promise<ApiKeyData> {
  const apiKey = extractApiKey(event)
  
  if (!apiKey) {
    apiLogger.logAuth(event, false, 'Missing API key')
    throw AuthErrors.missingApiKey()
  }
  
  // Validate key format
  if (!apiKey.startsWith('sk_live_')) {
    apiLogger.logAuth(event, false, 'Invalid API key format')
    throw AuthErrors.invalidApiKey()
  }
  
  const db = await useDrizzle(event)
  const keyHash = hashApiKey(apiKey)
  
  // Find API key in database
  const [apiKeyRecord] = await db
    .select()
    .from(api_keys)
    .where(
      and(
        eq(api_keys.key_hash, keyHash),
        eq(api_keys.is_active, true)
      )
    )
    .limit(1)
  
  if (!apiKeyRecord) {
    apiLogger.logAuth(event, false, 'Invalid or inactive API key')
    throw AuthErrors.invalidApiKey()
  }
  
  // Check expiration
  if (apiKeyRecord.expires_at && new Date(apiKeyRecord.expires_at) < new Date()) {
    apiLogger.logAuth(event, false, 'API key expired')
    throw AuthErrors.expiredApiKey()
  }
  
  // Log successful authentication
  apiLogger.logAuth(event, true)
  apiLogger.logRequest(event, apiKeyRecord.key_prefix)
  
  // Update last used timestamp (fire and forget)
  db.update(api_keys)
    .set({ last_used_at: new Date() })
    .where(eq(api_keys.id, apiKeyRecord.id))
    .execute()
    .catch(() => {}) // Ignore errors
  
  return {
    id: apiKeyRecord.id,
    user_id: apiKeyRecord.user_id || 'root',
    name: apiKeyRecord.name,
    permissions: apiKeyRecord.permissions,
    key_prefix: apiKeyRecord.key_prefix,
    is_root: !apiKeyRecord.user_id,
  }
}

/**
 * Check if API key has specific permission
 */
export function hasApiPermission(apiKey: ApiKeyData, permission: string): boolean {
  return apiKey.permissions.includes('*') || apiKey.permissions.includes(permission)
}

/**
 * Require specific API permission
 */
export function requireApiPermission(apiKey: ApiKeyData, permission: string): void {
  if (!hasApiPermission(apiKey, permission)) {
    throw AuthzErrors.insufficientPermissions(permission)
  }
}
