import type { H3Event } from 'h3'
import { getHeader, getRequestURL } from 'h3'

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

/**
 * Log entry structure
 */
interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: Record<string, any>
  event?: {
    method: string
    path: string
    ip?: string
    userAgent?: string
    apiKeyPrefix?: string
  }
}

/**
 * Format log entry for console output
 */
function formatLogEntry(entry: LogEntry): string {
  const parts = [
    `[${entry.timestamp}]`,
    `[${entry.level}]`,
    entry.message,
  ]
  
  if (entry.event) {
    parts.push(`- ${entry.event.method} ${entry.event.path}`)
    if (entry.event.apiKeyPrefix) {
      parts.push(`(API Key: ${entry.event.apiKeyPrefix}...)`)
    }
  }
  
  if (entry.context && Object.keys(entry.context).length > 0) {
    parts.push(`\n  Context: ${JSON.stringify(entry.context, null, 2)}`)
  }
  
  return parts.join(' ')
}

/**
 * Extract event information for logging
 */
function extractEventInfo(event: H3Event): LogEntry['event'] {
  const url = getRequestURL(event)
  const ip = getHeader(event, 'x-forwarded-for') || 
             getHeader(event, 'x-real-ip') || 
             event.node.req.socket.remoteAddress
  
  const eventInfo: NonNullable<LogEntry['event']> = {
    method: event.method || 'GET',
    path: url.pathname,
    userAgent: getHeader(event, 'user-agent'),
  }

  if (ip) {
    eventInfo.ip = ip
  }

  return eventInfo
}

/**
 * API Logger class
 */
class ApiLogger {
  private minLevel: LogLevel = LogLevel.INFO
  
  constructor() {
    // Set log level from environment
    const envLevel = process.env.LOG_LEVEL?.toUpperCase()
    if (envLevel && envLevel in LogLevel) {
      this.minLevel = LogLevel[envLevel as keyof typeof LogLevel]
    }
  }
  
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR]
    return levels.indexOf(level) >= levels.indexOf(this.minLevel)
  }
  
  private log(level: LogLevel, message: string, context?: Record<string, any>, event?: H3Event) {
    if (!this.shouldLog(level)) return
    
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      event: event ? extractEventInfo(event) : undefined,
    }
    
    const formatted = formatLogEntry(entry)
    
    switch (level) {
      case LogLevel.ERROR:
        console.error(formatted)
        break
      case LogLevel.WARN:
        console.warn(formatted)
        break
      case LogLevel.DEBUG:
        console.debug(formatted)
        break
      default:
        console.log(formatted)
    }
  }
  
  debug(message: string, context?: Record<string, any>, event?: H3Event) {
    this.log(LogLevel.DEBUG, message, context, event)
  }
  
  info(message: string, context?: Record<string, any>, event?: H3Event) {
    this.log(LogLevel.INFO, message, context, event)
  }
  
  warn(message: string, context?: Record<string, any>, event?: H3Event) {
    this.log(LogLevel.WARN, message, context, event)
  }
  
  error(message: string, context?: Record<string, any>, event?: H3Event) {
    this.log(LogLevel.ERROR, message, context, event)
  }
  
  /**
   * Log API request
   */
  logRequest(event: H3Event, apiKeyPrefix?: string) {
    const eventInfo = extractEventInfo(event)
    if (!eventInfo) {
      return
    }

    if (apiKeyPrefix) {
      eventInfo.apiKeyPrefix = apiKeyPrefix
    }
    
    this.info('API Request', {
      method: eventInfo.method,
      path: eventInfo.path,
      apiKey: apiKeyPrefix,
    }, event)
  }
  
  /**
   * Log API response
   */
  logResponse(event: H3Event, statusCode: number, duration: number) {
    this.info('API Response', {
      statusCode,
      duration: `${duration}ms`,
    }, event)
  }
  
  /**
   * Log API error
   */
  logError(event: H3Event, error: Error, statusCode?: number) {
    this.error('API Error', {
      error: error.message,
      stack: error.stack,
      statusCode,
    }, event)
  }
  
  /**
   * Log authentication attempt
   */
  logAuth(event: H3Event, success: boolean, reason?: string) {
    if (success) {
      this.info('Authentication successful', undefined, event)
    } else {
      this.warn('Authentication failed', { reason }, event)
    }
  }
  
  /**
   * Log rate limit hit
   */
  logRateLimit(event: H3Event, apiKeyPrefix: string, endpoint: string) {
    this.warn('Rate limit exceeded', {
      apiKey: apiKeyPrefix,
      endpoint,
    }, event)
  }
  
  /**
   * Log webhook delivery
   */
  logWebhookDelivery(webhookId: string, event: string, success: boolean, statusCode?: number, error?: string) {
    if (success) {
      this.info('Webhook delivered', {
        webhookId,
        event,
        statusCode,
      })
    } else {
      this.error('Webhook delivery failed', {
        webhookId,
        event,
        statusCode,
        error,
      })
    }
  }
  
  /**
   * Log database operation
   */
  logDatabase(operation: string, table: string, duration: number, error?: Error) {
    if (error) {
      this.error('Database operation failed', {
        operation,
        table,
        duration: `${duration}ms`,
        error: error.message,
      })
    } else {
      this.debug('Database operation', {
        operation,
        table,
        duration: `${duration}ms`,
      })
    }
  }
}

// Export singleton instance
export const apiLogger = new ApiLogger()

/**
 * Middleware to log API requests and responses
 */
export function createApiLoggingMiddleware() {
  return defineEventHandler(async (event) => {
    // Skip non-API routes
    const path = getRequestURL(event).pathname
    if (!path.startsWith('/api/v1/')) {
      return
    }
    
    const startTime = Date.now()
    
    // Log request
    apiLogger.logRequest(event)
    
    try {
      // Continue with request
      const response = await event.node.res
      
      // Log response
      const duration = Date.now() - startTime
      apiLogger.logResponse(event, response.statusCode || 200, duration)
      
      return response
    } catch (error: any) {
      // Log error
      const duration = Date.now() - startTime
      apiLogger.logError(event, error, error.statusCode)
      throw error
    }
  })
}
