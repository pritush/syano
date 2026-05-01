import { createError } from 'h3'
import type { H3Error } from 'h3'

/**
 * Standard API error codes
 */
export const API_ERROR_CODES = {
  // Authentication errors (401)
  INVALID_API_KEY: 'INVALID_API_KEY',
  EXPIRED_API_KEY: 'EXPIRED_API_KEY',
  INACTIVE_API_KEY: 'INACTIVE_API_KEY',
  MISSING_API_KEY: 'MISSING_API_KEY',
  
  // Authorization errors (403)
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  
  // Validation errors (400)
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_URL: 'INVALID_URL',
  INVALID_SLUG: 'INVALID_SLUG',
  
  // Resource errors (404)
  LINK_NOT_FOUND: 'LINK_NOT_FOUND',
  API_KEY_NOT_FOUND: 'API_KEY_NOT_FOUND',
  WEBHOOK_NOT_FOUND: 'WEBHOOK_NOT_FOUND',
  TAG_NOT_FOUND: 'TAG_NOT_FOUND',
  
  // Conflict errors (409)
  SLUG_ALREADY_EXISTS: 'SLUG_ALREADY_EXISTS',
  TAG_ALREADY_EXISTS: 'TAG_ALREADY_EXISTS',
  
  // Rate limiting (429)
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  
  // Server errors (500)
  DATABASE_ERROR: 'DATABASE_ERROR',
  WEBHOOK_DELIVERY_ERROR: 'WEBHOOK_DELIVERY_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const

export type ApiErrorCode = typeof API_ERROR_CODES[keyof typeof API_ERROR_CODES]

/**
 * Create a standardized API error
 */
export function createApiError(
  statusCode: number,
  code: ApiErrorCode,
  message: string,
  details?: any
): H3Error {
  return createError({
    statusCode,
    statusMessage: message,
    data: {
      code,
      message,
      details,
      timestamp: new Date().toISOString(),
    },
  })
}

/**
 * Authentication errors
 */
export const AuthErrors = {
  invalidApiKey: () => createApiError(
    401,
    API_ERROR_CODES.INVALID_API_KEY,
    'Invalid or inactive API key'
  ),
  
  expiredApiKey: () => createApiError(
    401,
    API_ERROR_CODES.EXPIRED_API_KEY,
    'API key has expired'
  ),
  
  inactiveApiKey: () => createApiError(
    401,
    API_ERROR_CODES.INACTIVE_API_KEY,
    'API key is inactive'
  ),
  
  missingApiKey: () => createApiError(
    401,
    API_ERROR_CODES.MISSING_API_KEY,
    'API key required. Provide via Authorization: Bearer <key> or X-API-Key header'
  ),
}

/**
 * Authorization errors
 */
export const AuthzErrors = {
  insufficientPermissions: (permission: string) => createApiError(
    403,
    API_ERROR_CODES.INSUFFICIENT_PERMISSIONS,
    `API key does not have '${permission}' permission`
  ),
}

/**
 * Validation errors
 */
export const ValidationErrors = {
  validationFailed: (errors: any[]) => createApiError(
    400,
    API_ERROR_CODES.VALIDATION_ERROR,
    'Validation failed',
    { errors }
  ),
  
  invalidUrl: (url: string) => createApiError(
    400,
    API_ERROR_CODES.INVALID_URL,
    'Invalid URL format',
    { url }
  ),
  
  invalidSlug: (slug: string) => createApiError(
    400,
    API_ERROR_CODES.INVALID_SLUG,
    'Invalid slug format. Only letters, numbers, hyphens, and underscores allowed',
    { slug }
  ),
}

/**
 * Resource errors
 */
export const ResourceErrors = {
  linkNotFound: (slug: string) => createApiError(
    404,
    API_ERROR_CODES.LINK_NOT_FOUND,
    `Link with slug '${slug}' not found`,
    { slug }
  ),
  
  apiKeyNotFound: () => createApiError(
    404,
    API_ERROR_CODES.API_KEY_NOT_FOUND,
    'API key not found'
  ),
  
  webhookNotFound: () => createApiError(
    404,
    API_ERROR_CODES.WEBHOOK_NOT_FOUND,
    'Webhook not found'
  ),
  
  tagNotFound: (name: string) => createApiError(
    404,
    API_ERROR_CODES.TAG_NOT_FOUND,
    `Tag '${name}' not found`,
    { name }
  ),
}

/**
 * Conflict errors
 */
export const ConflictErrors = {
  slugAlreadyExists: (slug: string) => createApiError(
    409,
    API_ERROR_CODES.SLUG_ALREADY_EXISTS,
    `Slug '${slug}' is already in use`,
    { slug }
  ),
  
  tagAlreadyExists: (name: string) => createApiError(
    409,
    API_ERROR_CODES.TAG_ALREADY_EXISTS,
    `Tag '${name}' already exists`,
    { name }
  ),
}

/**
 * Rate limiting errors
 */
export const RateLimitErrors = {
  rateLimitExceeded: (retryAfter: number, limit: number) => createApiError(
    429,
    API_ERROR_CODES.RATE_LIMIT_EXCEEDED,
    `Rate limit exceeded. Try again in ${retryAfter} seconds`,
    {
      limit,
      retryAfter,
      resetAt: new Date(Date.now() + retryAfter * 1000).toISOString(),
    }
  ),
}

/**
 * Server errors
 */
export const ServerErrors = {
  databaseError: (error: Error) => createApiError(
    500,
    API_ERROR_CODES.DATABASE_ERROR,
    'Database operation failed',
    { error: error.message }
  ),
  
  webhookDeliveryError: (error: Error) => createApiError(
    500,
    API_ERROR_CODES.WEBHOOK_DELIVERY_ERROR,
    'Failed to deliver webhook',
    { error: error.message }
  ),
  
  internalError: (error?: Error) => createApiError(
    500,
    API_ERROR_CODES.INTERNAL_ERROR,
    'Internal server error',
    error ? { error: error.message } : undefined
  ),
}

/**
 * Wrap database operations with error handling
 */
export async function withDatabaseErrorHandling<T>(
  operation: () => Promise<T>
): Promise<T> {
  try {
    return await operation()
  } catch (error: any) {
    console.error('[Database Error]', error)
    throw ServerErrors.databaseError(error)
  }
}

/**
 * Wrap webhook operations with error handling
 */
export async function withWebhookErrorHandling<T>(
  operation: () => Promise<T>
): Promise<T> {
  try {
    return await operation()
  } catch (error: any) {
    console.error('[Webhook Error]', error)
    throw ServerErrors.webhookDeliveryError(error)
  }
}
