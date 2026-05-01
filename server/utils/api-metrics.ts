/**
 * API Metrics Tracker
 * Tracks API usage, performance, and errors for monitoring
 */

interface MetricEntry {
  timestamp: number
  value: number
  labels?: Record<string, string>
}

interface Metrics {
  requests: MetricEntry[]
  errors: MetricEntry[]
  latency: MetricEntry[]
  rateLimits: MetricEntry[]
  webhookDeliveries: MetricEntry[]
}

class ApiMetrics {
  private metrics: Metrics = {
    requests: [],
    errors: [],
    latency: [],
    rateLimits: [],
    webhookDeliveries: [],
  }
  
  private maxEntries = 1000 // Keep last 1000 entries per metric
  private cleanupInterval: NodeJS.Timeout | null = null
  
  constructor() {
    // Cleanup old metrics every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 5 * 60 * 1000)
  }
  
  /**
   * Record a metric
   */
  private record(type: keyof Metrics, value: number, labels?: Record<string, string>) {
    const entry: MetricEntry = {
      timestamp: Date.now(),
      value,
      labels,
    }
    
    this.metrics[type].push(entry)
    
    // Keep only recent entries
    if (this.metrics[type].length > this.maxEntries) {
      this.metrics[type] = this.metrics[type].slice(-this.maxEntries)
    }
  }
  
  /**
   * Record API request
   */
  recordRequest(endpoint: string, method: string, statusCode: number) {
    this.record('requests', 1, {
      endpoint,
      method,
      status: statusCode.toString(),
    })
  }
  
  /**
   * Record API error
   */
  recordError(endpoint: string, errorCode: string, statusCode: number) {
    this.record('errors', 1, {
      endpoint,
      errorCode,
      status: statusCode.toString(),
    })
  }
  
  /**
   * Record request latency
   */
  recordLatency(endpoint: string, duration: number) {
    this.record('latency', duration, {
      endpoint,
    })
  }
  
  /**
   * Record rate limit hit
   */
  recordRateLimit(endpoint: string, apiKeyPrefix: string) {
    this.record('rateLimits', 1, {
      endpoint,
      apiKey: apiKeyPrefix,
    })
  }
  
  /**
   * Record webhook delivery
   */
  recordWebhookDelivery(event: string, success: boolean, duration: number) {
    this.record('webhookDeliveries', 1, {
      event,
      success: success.toString(),
    })
  }
  
  /**
   * Get metrics summary
   */
  getSummary(timeWindow: number = 3600000): {
    requests: { total: number; byEndpoint: Record<string, number>; byStatus: Record<string, number> }
    errors: { total: number; byCode: Record<string, number> }
    latency: { avg: number; p50: number; p95: number; p99: number }
    rateLimits: { total: number; byEndpoint: Record<string, number> }
    webhookDeliveries: { total: number; successful: number; failed: number }
  } {
    const now = Date.now()
    const cutoff = now - timeWindow
    
    // Filter recent entries
    const recentRequests = this.metrics.requests.filter(e => e.timestamp >= cutoff)
    const recentErrors = this.metrics.errors.filter(e => e.timestamp >= cutoff)
    const recentLatency = this.metrics.latency.filter(e => e.timestamp >= cutoff)
    const recentRateLimits = this.metrics.rateLimits.filter(e => e.timestamp >= cutoff)
    const recentWebhooks = this.metrics.webhookDeliveries.filter(e => e.timestamp >= cutoff)
    
    // Calculate request metrics
    const requestsByEndpoint: Record<string, number> = {}
    const requestsByStatus: Record<string, number> = {}
    recentRequests.forEach(entry => {
      if (entry.labels?.endpoint) {
        requestsByEndpoint[entry.labels.endpoint] = (requestsByEndpoint[entry.labels.endpoint] || 0) + 1
      }
      if (entry.labels?.status) {
        requestsByStatus[entry.labels.status] = (requestsByStatus[entry.labels.status] || 0) + 1
      }
    })
    
    // Calculate error metrics
    const errorsByCode: Record<string, number> = {}
    recentErrors.forEach(entry => {
      if (entry.labels?.errorCode) {
        errorsByCode[entry.labels.errorCode] = (errorsByCode[entry.labels.errorCode] || 0) + 1
      }
    })
    
    // Calculate latency metrics
    const latencies = recentLatency.map(e => e.value).sort((a, b) => a - b)
    const latencyAvg = latencies.length > 0 
      ? latencies.reduce((sum, val) => sum + val, 0) / latencies.length 
      : 0
    const latencyP50 = percentile(latencies, 0.5)
    const latencyP95 = percentile(latencies, 0.95)
    const latencyP99 = percentile(latencies, 0.99)
    
    // Calculate rate limit metrics
    const rateLimitsByEndpoint: Record<string, number> = {}
    recentRateLimits.forEach(entry => {
      if (entry.labels?.endpoint) {
        rateLimitsByEndpoint[entry.labels.endpoint] = (rateLimitsByEndpoint[entry.labels.endpoint] || 0) + 1
      }
    })
    
    // Calculate webhook metrics
    const webhookSuccessful = recentWebhooks.filter(e => e.labels?.success === 'true').length
    const webhookFailed = recentWebhooks.filter(e => e.labels?.success === 'false').length
    
    return {
      requests: {
        total: recentRequests.length,
        byEndpoint: requestsByEndpoint,
        byStatus: requestsByStatus,
      },
      errors: {
        total: recentErrors.length,
        byCode: errorsByCode,
      },
      latency: {
        avg: Math.round(latencyAvg),
        p50: Math.round(latencyP50),
        p95: Math.round(latencyP95),
        p99: Math.round(latencyP99),
      },
      rateLimits: {
        total: recentRateLimits.length,
        byEndpoint: rateLimitsByEndpoint,
      },
      webhookDeliveries: {
        total: recentWebhooks.length,
        successful: webhookSuccessful,
        failed: webhookFailed,
      },
    }
  }
  
  /**
   * Get health status
   */
  getHealth(): {
    status: 'healthy' | 'degraded' | 'unhealthy'
    checks: {
      errorRate: { status: 'pass' | 'warn' | 'fail'; value: number }
      latency: { status: 'pass' | 'warn' | 'fail'; value: number }
      rateLimits: { status: 'pass' | 'warn' | 'fail'; value: number }
    }
  } {
    const summary = this.getSummary(300000) // Last 5 minutes
    
    // Calculate error rate
    const errorRate = summary.requests.total > 0 
      ? (summary.errors.total / summary.requests.total) * 100 
      : 0
    
    const errorRateStatus = errorRate < 1 ? 'pass' : errorRate < 5 ? 'warn' : 'fail'
    const latencyStatus = summary.latency.p95 < 500 ? 'pass' : summary.latency.p95 < 1000 ? 'warn' : 'fail'
    const rateLimitStatus = summary.rateLimits.total < 10 ? 'pass' : summary.rateLimits.total < 50 ? 'warn' : 'fail'
    
    const failCount = [errorRateStatus, latencyStatus, rateLimitStatus].filter(s => s === 'fail').length
    const warnCount = [errorRateStatus, latencyStatus, rateLimitStatus].filter(s => s === 'warn').length
    
    const overallStatus = failCount > 0 ? 'unhealthy' : warnCount > 0 ? 'degraded' : 'healthy'
    
    return {
      status: overallStatus,
      checks: {
        errorRate: { status: errorRateStatus, value: Math.round(errorRate * 100) / 100 },
        latency: { status: latencyStatus, value: summary.latency.p95 },
        rateLimits: { status: rateLimitStatus, value: summary.rateLimits.total },
      },
    }
  }
  
  /**
   * Cleanup old metrics
   */
  private cleanup() {
    const cutoff = Date.now() - 3600000 // Keep last hour
    
    Object.keys(this.metrics).forEach(key => {
      const metricKey = key as keyof Metrics
      this.metrics[metricKey] = this.metrics[metricKey].filter(e => e.timestamp >= cutoff)
    })
  }
  
  /**
   * Reset all metrics
   */
  reset() {
    this.metrics = {
      requests: [],
      errors: [],
      latency: [],
      rateLimits: [],
      webhookDeliveries: [],
    }
  }
  
  /**
   * Cleanup on shutdown
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }
}

function percentile(values: number[], percentileValue: number) {
  if (values.length === 0) {
    return 0
  }

  const index = Math.min(values.length - 1, Math.floor(values.length * percentileValue))
  return values[index] ?? 0
}

// Export singleton instance
export const apiMetrics = new ApiMetrics()

// Cleanup on process exit
if (typeof process !== 'undefined') {
  process.on('exit', () => {
    apiMetrics.destroy()
  })
}
