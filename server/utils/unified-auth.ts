import type { H3Event } from 'h3'
import { getHeader } from 'h3'
import { getAuthUser } from '~/server/utils/auth'
import { requireApiKey } from '~/server/utils/api-auth'
import { AuthErrors, AuthzErrors } from '~/server/utils/api-errors'

/**
 * Unified authentication result
 * Can be either JWT-based user or API key-based
 */
export interface UnifiedAuth {
  type: 'jwt' | 'apikey'
  userId: string
  permissions: string[]
  // JWT-specific fields
  username?: string
  displayName?: string
  isRoot?: boolean
  // API key-specific fields
  apiKeyId?: string
  apiKeyName?: string
  apiKeyPrefix?: string
}

/**
 * Check if unified auth has a specific permission
 */
export function hasUnifiedPermission(auth: UnifiedAuth, permission: string): boolean {
  // Wildcard permission grants everything
  if (auth.permissions.includes('*')) {
    return true
  }
  
  // Check for exact permission match
  return auth.permissions.includes(permission)
}

/**
 * Require specific permission for unified auth
 */
export function requireUnifiedPermission(auth: UnifiedAuth, permission: string): void {
  if (!hasUnifiedPermission(auth, permission)) {
    throw AuthzErrors.insufficientPermissions(permission)
  }
}

/**
 * Extract authentication from request
 * Supports both JWT tokens (dashboard) and API keys (external)
 * 
 * Priority:
 * 1. Try API key authentication (sk_live_* format)
 * 2. Fall back to JWT token authentication
 */
export async function getUnifiedAuth(event: H3Event): Promise<UnifiedAuth | null> {
  const authHeader = getHeader(event, 'authorization')
  const bearerToken = authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7)
    : ''
  const apiKeyHeader = getHeader(event, 'x-api-key') || ''
  
  // 1. Try API key authentication first when either supported API-key header is present.
  if (bearerToken.startsWith('sk_live_') || apiKeyHeader.startsWith('sk_live_')) {
    const apiKey = await requireApiKey(event)
    return {
      type: 'apikey',
      userId: apiKey.user_id,
      permissions: apiKey.permissions,
      isRoot: apiKey.is_root,
      apiKeyId: apiKey.id,
      apiKeyName: apiKey.name,
      apiKeyPrefix: apiKey.key_prefix,
    }
  }
  
  // 2. Try JWT authentication (dashboard users)
  const jwtUser = await getAuthUser(event)
  if (jwtUser) {
    return {
      type: 'jwt',
      userId: jwtUser.id,
      permissions: jwtUser.permissions,
      username: jwtUser.username,
      displayName: jwtUser.displayName,
      isRoot: jwtUser.isRoot,
    }
  }
  
  return null
}

/**
 * Require authentication (either JWT or API key)
 * Throws 401 if not authenticated
 */
export async function requireUnifiedAuth(event: H3Event): Promise<UnifiedAuth> {
  const auth = await getUnifiedAuth(event)
  
  if (!auth) {
    throw AuthErrors.missingApiKey()
  }
  
  return auth
}

/**
 * Require authentication with specific permission
 * Throws 401 if not authenticated, 403 if insufficient permissions
 */
export async function requireUnifiedAuthWithPermission(event: H3Event, permission: string): Promise<UnifiedAuth> {
  const auth = await requireUnifiedAuth(event)
  requireUnifiedPermission(auth, permission)
  return auth
}

/**
 * Convert permission key to API permission format
 * Examples:
 * - LINKS_READ -> links:read
 * - ANALYTICS_READ -> analytics:read
 * - API_MANAGE -> api:manage
 */
export function permissionToApiFormat(permission: string): string {
  return permission.toLowerCase().replace('_', ':')
}
