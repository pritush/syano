import type { H3Event } from 'h3'
import { createError, getRequestIP } from 'h3'

/**
 * In-memory rate limiter for login attempts.
 * Uses a sliding window per IP address.
 * 
 * Limits: 5 failed attempts per 60 seconds per IP.
 * On exceeding the limit, returns a 429 with Retry-After header.
 */

interface LoginAttemptWindow {
  failedCount: number
  windowStart: number
}

const MAX_FAILED_ATTEMPTS = 5
const WINDOW_MS = 60_000 // 1 minute

const globalStore = globalThis as typeof globalThis & {
  __syanoLoginRateLimit?: Map<string, LoginAttemptWindow>
  __syanoLoginRateLimitCleanup?: NodeJS.Timeout
}

function getLoginRateLimitStore(): Map<string, LoginAttemptWindow> {
  if (!globalStore.__syanoLoginRateLimit) {
    globalStore.__syanoLoginRateLimit = new Map()
    // Clean up stale windows every 5 minutes
    globalStore.__syanoLoginRateLimitCleanup = setInterval(() => {
      const now = Date.now()
      for (const [key, window] of globalStore.__syanoLoginRateLimit!.entries()) {
        if (now - window.windowStart > 300_000) { // 5 minutes stale
          globalStore.__syanoLoginRateLimit!.delete(key)
        }
      }
    }, 300_000)
  }
  return globalStore.__syanoLoginRateLimit
}

function getClientIdentifier(event: H3Event): string {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  return `login:${ip}`
}

/**
 * Check if login attempts should be blocked for this client.
 * Call BEFORE processing the login request.
 * Throws 429 if the rate limit has been exceeded.
 */
export function checkLoginRateLimit(event: H3Event): void {
  const store = getLoginRateLimitStore()
  const key = getClientIdentifier(event)
  const now = Date.now()

  const window = store.get(key)

  // No record or expired window — allow
  if (!window || now - window.windowStart >= WINDOW_MS) {
    return
  }

  // Check if limit exceeded
  if (window.failedCount >= MAX_FAILED_ATTEMPTS) {
    const resetTime = window.windowStart + WINDOW_MS
    const retryAfter = Math.ceil((resetTime - now) / 1000)

    event.node.res.setHeader('Retry-After', retryAfter.toString())
    
    throw createError({
      statusCode: 429,
      statusMessage: 'Too many login attempts. Please try again later.',
    })
  }
}

/**
 * Record a failed login attempt.
 * Call AFTER a login attempt fails (wrong credentials).
 */
export function recordFailedLogin(event: H3Event): void {
  const store = getLoginRateLimitStore()
  const key = getClientIdentifier(event)
  const now = Date.now()

  let window = store.get(key)

  // Reset window if expired
  if (!window || now - window.windowStart >= WINDOW_MS) {
    window = { failedCount: 0, windowStart: now }
    store.set(key, window)
  }

  window.failedCount++
}

/**
 * Clear failed login attempts on successful login.
 * Call AFTER a login succeeds.
 */
export function clearLoginRateLimit(event: H3Event): void {
  const store = getLoginRateLimitStore()
  const key = getClientIdentifier(event)
  store.delete(key)
}
