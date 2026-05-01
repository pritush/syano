import { defineEventHandler, getQuery } from 'h3'
import { apiMetrics } from '~/server/utils/api-metrics'
import { requirePermission } from '~/server/utils/auth'
import { PERMISSIONS } from '~/shared/permissions'

/**
 * API Metrics Endpoint
 * GET /api/v1/metrics
 * 
 * Returns detailed API metrics for monitoring
 * Requires API_MANAGE permission
 */
export default defineEventHandler(async (event) => {
  await requirePermission(event, PERMISSIONS.API_MANAGE)
  
  const query = getQuery(event)
  const timeWindow = Number(query.window) || 3600000 // Default: 1 hour
  
  // Validate time window (max 24 hours)
  const validatedWindow = Math.min(timeWindow, 24 * 60 * 60 * 1000)
  
  const summary = apiMetrics.getSummary(validatedWindow)
  const health = apiMetrics.getHealth()
  
  return {
    success: true,
    data: {
      timeWindow: validatedWindow,
      timeWindowLabel: formatTimeWindow(validatedWindow),
      health: health.status,
      summary,
      topEndpoints: getTopEndpoints(summary.requests.byEndpoint, 10),
      topErrors: getTopErrors(summary.errors.byCode, 10),
      recommendations: generateRecommendations(summary, health),
    },
  }
})

/**
 * Format time window for display
 */
function formatTimeWindow(ms: number): string {
  const minutes = Math.floor(ms / 60000)
  const hours = Math.floor(minutes / 60)
  
  if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''}`
  }
  return `${minutes} minute${minutes > 1 ? 's' : ''}`
}

/**
 * Get top endpoints by request count
 */
function getTopEndpoints(byEndpoint: Record<string, number>, limit: number) {
  return Object.entries(byEndpoint)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([endpoint, count]) => ({ endpoint, count }))
}

/**
 * Get top errors by count
 */
function getTopErrors(byCode: Record<string, number>, limit: number) {
  return Object.entries(byCode)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([code, count]) => ({ code, count }))
}

/**
 * Generate recommendations based on metrics
 */
function generateRecommendations(summary: any, health: any): string[] {
  const recommendations: string[] = []
  
  // High error rate
  if (health.checks.errorRate.status === 'fail') {
    recommendations.push('High error rate detected. Review error logs and fix failing endpoints.')
  }
  
  // High latency
  if (health.checks.latency.status === 'fail') {
    recommendations.push('High API latency detected. Consider optimizing database queries or adding caching.')
  }
  
  // Frequent rate limiting
  if (health.checks.rateLimits.status === 'fail') {
    recommendations.push('Frequent rate limiting detected. Consider increasing rate limits or optimizing client requests.')
  }
  
  // Low webhook success rate
  const webhookSuccessRate = summary.webhookDeliveries.total > 0
    ? (summary.webhookDeliveries.successful / summary.webhookDeliveries.total) * 100
    : 100
  
  if (webhookSuccessRate < 80) {
    recommendations.push('Low webhook delivery success rate. Check webhook endpoints and network connectivity.')
  }
  
  // No issues
  if (recommendations.length === 0) {
    recommendations.push('All systems operating normally.')
  }
  
  return recommendations
}
