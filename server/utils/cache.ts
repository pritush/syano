import type { H3Event } from 'h3'
import { useRuntimeConfig } from '#imports'

/**
 * In-memory LRU cache for database query results
 * Reduces database load for frequently accessed data
 */

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

class LRUCache<T> {
  private cache = new Map<string, CacheEntry<T>>()
  private maxSize: number
  private ttl: number

  constructor(maxSize = 1000, ttlSeconds = 60) {
    this.maxSize = maxSize
    this.ttl = ttlSeconds * 1000
  }

  get(key: string): T | null {
    const entry = this.cache.get(key)
    
    if (!entry) {
      return null
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }

    // Move to end (most recently used)
    this.cache.delete(key)
    this.cache.set(key, entry)
    
    return entry.value
  }

  set(key: string, value: T, customTtl?: number): void {
    // Remove oldest entry if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) {
        this.cache.delete(firstKey)
      }
    }

    const ttl = customTtl ? customTtl * 1000 : this.ttl
    
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttl,
    })
  }

  delete(key: string): void {
    this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  size(): number {
    return this.cache.size
  }

  // Clean up expired entries
  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key)
      }
    }
  }
}

// Global cache instances
const globalStore = globalThis as typeof globalThis & {
  __syanoLinkCache?: LRUCache<any>
  __syanoSettingsCache?: LRUCache<any>
  __syanoTagsCache?: LRUCache<any>
  __syanoAnalyticsCache?: LRUCache<any>
  __syanoCacheCleanupInterval?: NodeJS.Timeout
}

// Initialize caches
if (!globalStore.__syanoLinkCache) {
  globalStore.__syanoLinkCache = new LRUCache(2000, 60) // 2000 links, 60s TTL
}

if (!globalStore.__syanoSettingsCache) {
  globalStore.__syanoSettingsCache = new LRUCache(10, 300) // 10 items, 5min TTL
}

if (!globalStore.__syanoTagsCache) {
  globalStore.__syanoTagsCache = new LRUCache(100, 180) // 100 items, 3min TTL
}

if (!globalStore.__syanoAnalyticsCache) {
  globalStore.__syanoAnalyticsCache = new LRUCache(500, 300) // 500 items, 5min TTL
}

// Periodic cleanup (every 5 minutes)
if (!globalStore.__syanoCacheCleanupInterval) {
  globalStore.__syanoCacheCleanupInterval = setInterval(() => {
    globalStore.__syanoLinkCache?.cleanup()
    globalStore.__syanoSettingsCache?.cleanup()
    globalStore.__syanoTagsCache?.cleanup()
    globalStore.__syanoAnalyticsCache?.cleanup()
  }, 5 * 60 * 1000)
}

/**
 * Get link cache instance
 */
export function useLinkCache() {
  return globalStore.__syanoLinkCache!
}

/**
 * Get settings cache instance
 */
export function useSettingsCache() {
  return globalStore.__syanoSettingsCache!
}

/**
 * Get tags cache instance
 */
export function useTagsCache() {
  return globalStore.__syanoTagsCache!
}

/**
 * Get analytics cache instance
 */
export function useAnalyticsCache() {
  return globalStore.__syanoAnalyticsCache!
}

/**
 * Invalidate link cache entry
 */
export function invalidateLinkCache(slug: string, caseSensitive = false) {
  const cache = useLinkCache()
  const normalized = caseSensitive ? slug.trim() : slug.trim().toLowerCase()
  cache.delete(`link:${normalized}`)
}

/**
 * Invalidate all link caches
 */
export function invalidateAllLinkCache() {
  useLinkCache().clear()
}

/**
 * Invalidate settings cache
 */
export function invalidateSettingsCache() {
  useSettingsCache().clear()
}

/**
 * Invalidate tags cache
 */
export function invalidateTagsCache() {
  useTagsCache().clear()
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    links: {
      size: globalStore.__syanoLinkCache?.size() || 0,
      maxSize: 2000,
    },
    settings: {
      size: globalStore.__syanoSettingsCache?.size() || 0,
      maxSize: 10,
    },
    tags: {
      size: globalStore.__syanoTagsCache?.size() || 0,
      maxSize: 100,
    },
    analytics: {
      size: globalStore.__syanoAnalyticsCache?.size() || 0,
      maxSize: 500,
    },
  }
}
