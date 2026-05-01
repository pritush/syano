import { defineEventHandler } from 'h3'
import { apiMetrics } from '~/server/utils/api-metrics'
import { useDrizzle } from '~/server/utils/db'
import { sql } from 'drizzle-orm'

/**
 * API Health Check Endpoint
 * GET /api/v1/health
 * 
 * Returns health status and metrics for monitoring
 * No authentication required for health checks
 */
export default defineEventHandler(async (event) => {
  const startTime = Date.now()
  
  // Check database connectivity
  let dbHealthy = false
  let dbLatency = 0
  try {
    const dbStart = Date.now()
    const db = await useDrizzle(event)
    await db.execute(sql`SELECT 1`)
    dbLatency = Date.now() - dbStart
    dbHealthy = true
  } catch (error) {
    console.error('[Health Check] Database check failed:', error)
  }
  
  // Get API metrics
  const metrics = apiMetrics.getSummary(300000) // Last 5 minutes
  const health = apiMetrics.getHealth()
  
  // Calculate overall health
  const overallHealthy = dbHealthy && health.status !== 'unhealthy'
  const statusCode = overallHealthy ? 200 : 503
  
  event.node.res.statusCode = statusCode
  
  return {
    status: overallHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      database: {
        status: dbHealthy ? 'pass' : 'fail',
        latency: dbLatency,
      },
      api: health.checks,
    },
    metrics: {
      requests: {
        total: metrics.requests.total,
        byStatus: metrics.requests.byStatus,
      },
      errors: {
        total: metrics.errors.total,
        rate: metrics.requests.total > 0 
          ? Math.round((metrics.errors.total / metrics.requests.total) * 10000) / 100 
          : 0,
      },
      latency: {
        avg: metrics.latency.avg,
        p95: metrics.latency.p95,
        p99: metrics.latency.p99,
      },
      rateLimits: {
        total: metrics.rateLimits.total,
      },
      webhooks: {
        total: metrics.webhookDeliveries.total,
        successRate: metrics.webhookDeliveries.total > 0
          ? Math.round((metrics.webhookDeliveries.successful / metrics.webhookDeliveries.total) * 10000) / 100
          : 100,
      },
    },
    responseTime: Date.now() - startTime,
  }
})
