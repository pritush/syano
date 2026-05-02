import { defineEventHandler } from 'h3'
import { requireUnifiedAuth, requireUnifiedPermission } from '~/server/utils/unified-auth'
import { getCacheStats } from '~/server/utils/cache'
import { getConnectionHealth } from '~/server/utils/db'

/**
 * Get cache and database connection statistics
 * GET /api/v1/cache/stats
 * 
 * Requires: system:manage permission
 */
export default defineEventHandler(async (event) => {
  const auth = await requireUnifiedAuth(event)
  requireUnifiedPermission(auth, 'system:manage')

  const cacheStats = getCacheStats()
  const dbHealth = getConnectionHealth()

  return {
    success: true,
    data: {
      cache: cacheStats,
      database: {
        connected: dbHealth.connected,
        pool_size: dbHealth.poolSize,
        idle_connections: dbHealth.idleConnections,
        waiting_clients: dbHealth.waitingClients,
        connection_attempts: dbHealth.attempts,
        last_error: dbHealth.lastError || null,
      },
      timestamp: new Date().toISOString(),
    },
  }
})
