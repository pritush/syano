import { defineEventHandler, getRequestURL } from 'h3'
import { apiMetrics } from '~/server/utils/api-metrics'

/**
 * API Metrics Middleware
 * Tracks request/response metrics for monitoring
 */
export default defineEventHandler(async (event) => {
  const url = getRequestURL(event)
  
  // Only track API v1 endpoints
  if (!url.pathname.startsWith('/api/v1/')) {
    return
  }
  
  const startTime = Date.now()
  const method = event.method || 'GET'
  const endpoint = url.pathname

  let recorded = false
  const record = (statusCode: number, errorCode?: string) => {
    if (recorded) {
      return
    }

    recorded = true
    const duration = Date.now() - startTime

    apiMetrics.recordRequest(endpoint, method, statusCode)
    apiMetrics.recordLatency(endpoint, duration)

    if (statusCode >= 400) {
      apiMetrics.recordError(endpoint, errorCode || 'HTTP_ERROR', statusCode)
    }
  }

  event.node.res.once('finish', () => {
    record(event.node.res.statusCode || 200)
  })

  event.node.res.once('close', () => {
    record(event.node.res.statusCode || 499, 'CONNECTION_CLOSED')
  })
})
