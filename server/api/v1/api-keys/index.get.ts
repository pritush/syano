import { defineEventHandler, createError } from 'h3'
import { eq, desc, isNull, sql } from 'drizzle-orm'
import { useDrizzle } from '~/server/utils/db'
import { api_keys } from '~/server/database/schema'
import { requirePermission } from '~/server/utils/auth'
import { PERMISSIONS } from '~/shared/permissions'

/**
 * List API keys for authenticated user
 * GET /api/v1/api-keys
 * Requires API_MANAGE permission
 */
export default defineEventHandler(async (event) => {
  try {
    const user = await requirePermission(event, PERMISSIONS.API_MANAGE)
    const db = await useDrizzle(event)
    
    // Root user's keys have user_id = null
    const userFilter = user.isRoot
      ? isNull(api_keys.user_id)
      : eq(api_keys.user_id, user.id)
    
    // Check if key_encrypted column exists
    const columnCheck = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'api_keys' AND column_name = 'key_encrypted';
    `)
    
    const hasEncryptedColumn = columnCheck.rows.length > 0
    
    if (hasEncryptedColumn) {
      // Query with key_encrypted column
      const keys = await db
        .select({
          id: api_keys.id,
          name: api_keys.name,
          key_prefix: api_keys.key_prefix,
          permissions: api_keys.permissions,
          is_active: api_keys.is_active,
          last_used_at: api_keys.last_used_at,
          expires_at: api_keys.expires_at,
          created_at: api_keys.created_at,
          can_reveal: api_keys.key_encrypted,
        })
        .from(api_keys)
        .where(userFilter)
        .orderBy(desc(api_keys.created_at))
      
      return {
        success: true,
        data: keys,
        encryption_available: true, // Flag to indicate encryption is available
      }
    } else {
      // Query without key_encrypted column (backward compatibility)
      const keys = await db
        .select({
          id: api_keys.id,
          name: api_keys.name,
          key_prefix: api_keys.key_prefix,
          permissions: api_keys.permissions,
          is_active: api_keys.is_active,
          last_used_at: api_keys.last_used_at,
          expires_at: api_keys.expires_at,
          created_at: api_keys.created_at,
        })
        .from(api_keys)
        .where(userFilter)
        .orderBy(desc(api_keys.created_at))
      
      // Don't add can_reveal field at all when column doesn't exist
      return {
        success: true,
        data: keys,
        encryption_available: false, // Flag to indicate encryption is NOT available
      }
    }
  } catch (error: any) {
    console.error('API Keys list error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Internal Server Error',
      message: error.message || 'Failed to fetch API keys',
    })
  }
})
