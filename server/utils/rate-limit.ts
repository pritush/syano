import type { H3Event } from 'h3'
import { createError } from 'h3'
import { eq, and, gte, lt } from 'drizzle-orm'
import { useDrizzle } from '~/server/utils/db'
import { api_rate_limits } from '~/server/database/schema'
import type { ApiKeyData } from '~/server/utils/api-auth'
import { RateLimitErrors } from '~/server/utils/api-errors'
import { apiLogger } from '~/server/utils/api-logger'
import { apiMetrics } from '~/server/utils/api-metrics'

interface RateLimitConfig {
  maxRequests: number
  windowMs: number // Time window in milliseconds
}

// Default rate limits per endpoint
const RATE_LIMITS: Record<string, RateLimitConfig> = {
  '/api/v1/links': { maxRequests: 100, windowMs: 60000 }, // 100 requests per minute
  '/api/v1/links/bulk': { maxRequests: 10, windowMs: 60000 }, // 10 requests per minute
  '/api/v1/analytics': { maxRequests: 200, windowMs: 60000 }, // 200 requests per minute
  'default': { maxRequests: 60, windowMs: 60000 }, // 60 requests per minute
}

/**
 * Get rate limit config for endpoint
 */
function getRateLimitConfig(endpoint: string): RateLimitConfig {
  // Check for exact match
  if (RATE_LIMITS[endpoint]) {
    return RATE_LIMITS[endpoint]
  }
  
  // Check for prefix match
  for (const [pattern, config] of Object.entries(RATE_LIMITS)) {
    if (endpoint.startsWith(pattern)) {
      return config
    }
  }
  
  return RATE_LIMITS.default!
}

/**
 * Check and enforce rate limit for API key
 */
export async function checkRateLimit(
  event: H3Event,
  apiKey: ApiKeyData,
  endpoint: string
): Promise<void> {
  const config = getRateLimitConfig(endpoint)
  const db = await useDrizzle(event)
  
  const windowStart = new Date(Date.now() - config.windowMs)
  
  // Get current rate limit record
  const [rateLimitRecord] = await db
    .select()
    .from(api_rate_limits)
    .where(
      and(
        eq(api_rate_limits.api_key_id, apiKey.id),
        eq(api_rate_limits.endpoint, endpoint),
        gte(api_rate_limits.window_start, windowStart)
      )
    )
    .limit(1)
  
  if (rateLimitRecord) {
    // Check if limit exceeded
    const requestCount = rateLimitRecord.request_count ?? 0
    const windowStart = rateLimitRecord.window_start ?? new Date()

    if (requestCount >= config.maxRequests) {
      const resetTime = new Date(windowStart.getTime() + config.windowMs)
      const retryAfter = Math.ceil((resetTime.getTime() - Date.now()) / 1000)
      
      // Log rate limit hit
      apiLogger.logRateLimit(event, apiKey.key_prefix, endpoint)
      apiMetrics.recordRateLimit(endpoint, apiKey.key_prefix)
      
      throw RateLimitErrors.rateLimitExceeded(retryAfter, config.maxRequests)
    }
    
    // Increment counter
    await db
      .update(api_rate_limits)
      .set({ request_count: requestCount + 1 })
      .where(eq(api_rate_limits.id, rateLimitRecord.id))
    
    // Set rate limit headers
    const remaining = config.maxRequests - requestCount - 1
    const resetTime = new Date(windowStart.getTime() + config.windowMs)
    
    event.node.res.setHeader('X-RateLimit-Limit', config.maxRequests.toString())
    event.node.res.setHeader('X-RateLimit-Remaining', remaining.toString())
    event.node.res.setHeader('X-RateLimit-Reset', resetTime.toISOString())
  } else {
    // Create new rate limit record
    await db.insert(api_rate_limits).values({
      api_key_id: apiKey.id,
      endpoint,
      request_count: 1,
      window_start: new Date(),
    })
    
    // Set rate limit headers
    event.node.res.setHeader('X-RateLimit-Limit', config.maxRequests.toString())
    event.node.res.setHeader('X-RateLimit-Remaining', (config.maxRequests - 1).toString())
    event.node.res.setHeader('X-RateLimit-Reset', new Date(Date.now() + config.windowMs).toISOString())
  }
}

/**
 * Clean up old rate limit records (call periodically)
 */
export async function cleanupRateLimits(event: H3Event): Promise<void> {
  const db = await useDrizzle(event)
  const cutoffTime = new Date(Date.now() - 3600000) // 1 hour ago
  
  await db
    .delete(api_rate_limits)
    .where(lt(api_rate_limits.window_start, cutoffTime))
}
