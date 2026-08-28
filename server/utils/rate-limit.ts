import type { H3Event } from 'h3'
import { createError } from 'h3'
import { lt } from 'drizzle-orm'
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

// ── In-memory sliding window rate limiter ──────────────────
// Eliminates 2 DB roundtrips per API request compared to the old approach

interface RateLimitWindow {
  count: number
  start: number
}

const globalStore = globalThis as typeof globalThis & {
  __syanoRateLimitWindows?: Map<string, RateLimitWindow>
  __syanoRateLimitCleanup?: NodeJS.Timeout
}

function getRateLimitStore(): Map<string, RateLimitWindow> {
  if (!globalStore.__syanoRateLimitWindows) {
    globalStore.__syanoRateLimitWindows = new Map()
    // Clean up expired windows every 2 minutes
    globalStore.__syanoRateLimitCleanup = setInterval(() => {
      const now = Date.now()
      for (const [key, window] of globalStore.__syanoRateLimitWindows!.entries()) {
        if (now - window.start > 120000) { // 2 minutes stale
          globalStore.__syanoRateLimitWindows!.delete(key)
        }
      }
    }, 120000)
  }
  return globalStore.__syanoRateLimitWindows
}

/**
 * Check and enforce rate limit for API key (in-memory, no DB queries)
 */
export async function checkRateLimit(
  event: H3Event,
  apiKey: ApiKeyData,
  endpoint: string
): Promise<void> {
  const config = getRateLimitConfig(endpoint)
  const store = getRateLimitStore()
  const key = `${apiKey.id}:${endpoint}`
  const now = Date.now()

  let window = store.get(key)

  // Reset window if expired
  if (!window || now - window.start >= config.windowMs) {
    window = { count: 0, start: now }
    store.set(key, window)
  }

  // Check if limit exceeded
  if (window.count >= config.maxRequests) {
    const resetTime = new Date(window.start + config.windowMs)
    const retryAfter = Math.ceil((resetTime.getTime() - now) / 1000)
    
    // Log rate limit hit
    apiLogger.logRateLimit(event, apiKey.key_prefix, endpoint)
    apiMetrics.recordRateLimit(endpoint, apiKey.key_prefix)
    
    throw RateLimitErrors.rateLimitExceeded(retryAfter, config.maxRequests)
  }

  // Increment counter
  window.count++

  // Set rate limit headers
  const remaining = config.maxRequests - window.count
  const resetTime = new Date(window.start + config.windowMs)
  
  event.node.res.setHeader('X-RateLimit-Limit', config.maxRequests.toString())
  event.node.res.setHeader('X-RateLimit-Remaining', remaining.toString())
  event.node.res.setHeader('X-RateLimit-Reset', resetTime.toISOString())
}

/**
 * Clean up old rate limit records from the DB (call periodically)
 */
export async function cleanupRateLimits(event: H3Event): Promise<void> {
  const db = await useDrizzle(event)
  const cutoffTime = new Date(Date.now() - 3600000) // 1 hour ago
  
  await db
    .delete(api_rate_limits)
    .where(lt(api_rate_limits.window_start, cutoffTime))
}
