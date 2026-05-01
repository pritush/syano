import { defineEventHandler } from 'h3'
import { useDrizzle } from '~/server/utils/db'
import { api_keys } from '~/server/database/schema'
import { requirePermission } from '~/server/utils/auth'
import { PERMISSIONS } from '~/shared/permissions'
import { sql } from 'drizzle-orm'

/**
 * Debug endpoint to check API key encryption status
 * GET /api/v1/api-keys/debug
 * Requires API_MANAGE permission
 * 
 * This endpoint helps troubleshoot encryption issues
 */
export default defineEventHandler(async (event) => {
  await requirePermission(event, PERMISSIONS.API_MANAGE)
  const db = await useDrizzle(event)
  
  // Check if key_encrypted column exists
  const columnCheck = await db.execute(sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns 
    WHERE table_name = 'api_keys' AND column_name = 'key_encrypted';
  `)
  
  // Count keys with and without encryption
  const stats = await db.execute(sql`
    SELECT 
      COUNT(*) as total_keys,
      COUNT(key_encrypted) as encrypted_keys,
      COUNT(*) - COUNT(key_encrypted) as unencrypted_keys
    FROM api_keys;
  `)
  
  // Check encryption key environment variable
  const hasEncryptionKey = !!process.env.ENCRYPTION_KEY
  const encryptionKeyLength = process.env.ENCRYPTION_KEY?.length || 0
  
  return {
    success: true,
    data: {
      database: {
        column_exists: columnCheck.rows.length > 0,
        column_info: columnCheck.rows[0] || null,
      },
      statistics: stats.rows[0] || {},
      environment: {
        has_encryption_key: hasEncryptionKey,
        encryption_key_length: encryptionKeyLength,
        using_default_key: !process.env.ENCRYPTION_KEY,
      },
      recommendations: getRecommendations(
        columnCheck.rows.length > 0,
        hasEncryptionKey,
        stats.rows[0]
      ),
    },
  }
})

function getRecommendations(columnExists: boolean, hasKey: boolean, stats: any) {
  const recommendations = []
  
  if (!columnExists) {
    recommendations.push({
      level: 'error',
      message: 'The key_encrypted column does not exist. Run the database upgrade.',
      action: 'Go to Dashboard → Data Ops → Run Database Upgrade',
    })
  }
  
  if (!hasKey) {
    recommendations.push({
      level: 'warning',
      message: 'ENCRYPTION_KEY environment variable is not set. Using default key (NOT SECURE).',
      action: 'Set ENCRYPTION_KEY in your .env file. Generate with: openssl rand -base64 32',
    })
  }
  
  if (stats && stats.unencrypted_keys > 0) {
    recommendations.push({
      level: 'info',
      message: `${stats.unencrypted_keys} API key(s) cannot be revealed (created before encryption).`,
      action: 'Create new API keys to replace old ones, then revoke the old keys.',
    })
  }
  
  if (columnExists && hasKey && stats && stats.encrypted_keys > 0) {
    recommendations.push({
      level: 'success',
      message: `Everything looks good! ${stats.encrypted_keys} API key(s) can be revealed.`,
      action: 'No action needed.',
    })
  }
  
  return recommendations
}
