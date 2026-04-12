import { sql } from 'drizzle-orm'

/**
 * Health check endpoint for monitoring database connectivity
 * GET /api/health
 */
export default defineEventHandler(async (event) => {
  const startTime = Date.now()
  
  try {
    const db = await useDrizzle(event)
    
    // Test database connection with a simple query
    await db.execute(sql`SELECT 1 as health_check`)
    
    const responseTime = Date.now() - startTime
    const health = getConnectionHealth()
    
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        responseTime: `${responseTime}ms`,
        pool: {
          total: health.poolSize,
          idle: health.idleConnections,
          waiting: health.waitingClients,
        },
      },
      environment: process.env.NODE_ENV || 'development',
    }
  } catch (error: any) {
    const responseTime = Date.now() - startTime
    const health = getConnectionHealth()
    
    // Set error status code
    setResponseStatus(event, 503)
    
    return {
      status: 'error',
      timestamp: new Date().toISOString(),
      database: {
        connected: false,
        responseTime: `${responseTime}ms`,
        error: error?.message || 'Unknown database error',
        attempts: health.attempts,
        lastError: health.lastError,
      },
      environment: process.env.NODE_ENV || 'development',
    }
  }
})
