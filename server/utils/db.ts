import type { H3Event } from 'h3'
import { createError } from 'h3'
import { existsSync, readFileSync } from 'node:fs'
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool, type PoolConfig } from 'pg'
import { useRuntimeConfig } from '#imports'
import * as schema from '~/server/database/schema'

type DrizzleDatabase = NodePgDatabase<typeof schema>

const globalStore = globalThis as typeof globalThis & {
  __syanoPool?: Pool
  __syanoDb?: DrizzleDatabase
  __syanoDatabaseUrl?: string
  __syanoConnectionAttempts?: number
  __syanoLastConnectionError?: string
}

interface ConnectionValidationResult {
  valid: boolean
  error?: string
  details?: string
}

function readDotEnvDatabaseUrl() {
  const envPath = '.env'

  if (!existsSync(envPath)) {
    return ''
  }

  const envRaw = readFileSync(envPath, 'utf8')

  for (const line of envRaw.split(/\r?\n/)) {
    if (!line || /^\s*#/.test(line)) {
      continue
    }

    const index = line.indexOf('=')
    if (index === -1) {
      continue
    }

    const key = line.slice(0, index).trim()

    if (key !== 'NUXT_DATABASE_URL' && key !== 'DATABASE_URL') {
      continue
    }

    let value = line.slice(index + 1).trim()

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }

    if (value) {
      return value
    }
  }

  return ''
}

/**
 * Validates database connection string format and provides helpful error messages
 */
function validateConnectionString(connectionString: string): ConnectionValidationResult {
  if (!connectionString || connectionString.trim() === '') {
    return {
      valid: false,
      error: 'DATABASE_URL is empty or not configured',
      details: 'Please set NUXT_DATABASE_URL or DATABASE_URL environment variable',
    }
  }

  // Check if it's a valid PostgreSQL connection string
  if (!connectionString.startsWith('postgres://') && !connectionString.startsWith('postgresql://')) {
    return {
      valid: false,
      error: 'Invalid database connection string format',
      details: 'Connection string must start with postgres:// or postgresql://',
    }
  }

  // Try to parse the URL to validate format
  try {
    const url = new URL(connectionString)
    
    if (!url.hostname) {
      return {
        valid: false,
        error: 'Missing database host',
        details: 'Connection string must include a valid hostname',
      }
    }

    if (!url.pathname || url.pathname === '/') {
      return {
        valid: false,
        error: 'Missing database name',
        details: 'Connection string must include a database name in the path',
      }
    }

    return { valid: true }
  } catch (error) {
    return {
      valid: false,
      error: 'Malformed database connection string',
      details: error instanceof Error ? error.message : 'Unable to parse connection string',
    }
  }
}

/**
 * Auto-detects if SSL should be enabled based on connection string
 */
function shouldUseSSL(connectionString: string): boolean {
  // Check for explicit sslmode in connection string
  if (connectionString.includes('sslmode=require') || connectionString.includes('sslmode=verify-')) {
    return true
  }

  if (connectionString.includes('sslmode=disable') || connectionString.includes('sslmode=prefer')) {
    return false
  }

  // Auto-detect cloud providers that require SSL
  const cloudProviders = [
    'supabase.co',
    'neon.tech',
    'aivencloud.com',
    'aws.com',
    'azure.com',
    'digitalocean.com',
    'heroku.com',
    'railway.app',
  ]

  return cloudProviders.some(provider => connectionString.includes(provider))
}

/**
 * Resolves and validates database URL from various sources
 */
function resolveDatabaseUrl(event?: H3Event): string {
  const config = useRuntimeConfig(event)
  const databaseUrl = config.databaseUrl || process.env.NUXT_DATABASE_URL || process.env.DATABASE_URL || readDotEnvDatabaseUrl() || ''

  const validation = validateConnectionString(databaseUrl)
  
  if (!validation.valid) {
    throw createError({
      statusCode: 500,
      statusMessage: validation.error || 'Invalid database configuration',
      message: validation.details,
    })
  }

  return databaseUrl
}

/**
 * Creates pool configuration with SSL auto-detection and optimized settings
 */
function createPoolConfig(databaseUrl: string): PoolConfig {
  const useSSL = shouldUseSSL(databaseUrl)
  
  // Detect if running in serverless environment
  const isServerless = !!(
    process.env.VERCEL ||
    process.env.NETLIFY ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.FUNCTION_NAME
  )

  const config: PoolConfig = {
    connectionString: databaseUrl,
    // Smaller pool for serverless, larger for traditional hosting
    max: isServerless ? 5 : 20,
    min: isServerless ? 0 : 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  }

  // Configure SSL if needed
  if (useSSL) {
    config.ssl = {
      rejectUnauthorized: false, // Allow self-signed certificates (common in cloud providers)
    }
  }

  return config
}

/**
 * Attempts to connect to database with retry logic for cold starts
 */
async function connectWithRetry(pool: Pool, maxRetries = 3, baseDelay = 1000): Promise<void> {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Test the connection
      const client = await pool.connect()
      await client.query('SELECT 1')
      client.release()
      
      // Reset connection attempts on success
      globalStore.__syanoConnectionAttempts = 0
      globalStore.__syanoLastConnectionError = undefined
      
      return // Success!
    } catch (error) {
      lastError = error as Error
      globalStore.__syanoConnectionAttempts = attempt
      globalStore.__syanoLastConnectionError = lastError.message

      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = baseDelay * Math.pow(2, attempt - 1)
        console.warn(`[Syano DB] Connection attempt ${attempt}/${maxRetries} failed. Retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  // All retries failed
  throw createError({
    statusCode: 500,
    statusMessage: 'Database connection failed',
    message: `Failed to connect after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`,
  })
}

/**
 * Gets or creates the database connection pool with retry logic
 */
export async function usePool(event?: H3Event): Promise<Pool> {
  const databaseUrl = resolveDatabaseUrl(event)

  if (!globalStore.__syanoPool || globalStore.__syanoDatabaseUrl !== databaseUrl) {
    globalStore.__syanoDatabaseUrl = databaseUrl
    
    const poolConfig = createPoolConfig(databaseUrl)
    globalStore.__syanoPool = new Pool(poolConfig)
    
    // Set up error handler for the pool
    globalStore.__syanoPool.on('error', (err) => {
      console.error('[Syano DB] Unexpected pool error:', err)
      globalStore.__syanoLastConnectionError = err.message
    })

    // Test connection with retry logic
    try {
      await connectWithRetry(globalStore.__syanoPool)
      console.log('[Syano DB] Database connection established successfully')
    } catch (error) {
      // Clean up failed pool
      await globalStore.__syanoPool.end()
      globalStore.__syanoPool = undefined
      globalStore.__syanoDb = undefined
      throw error
    }

    globalStore.__syanoDb = drizzle(globalStore.__syanoPool, { schema })
  }

  return globalStore.__syanoPool
}

/**
 * Gets the Drizzle database instance
 */
export async function useDrizzle(event?: H3Event): Promise<DrizzleDatabase> {
  await usePool(event)
  
  if (!globalStore.__syanoDb) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Database not initialized',
      message: 'Database connection pool was not properly initialized',
    })
  }
  
  return globalStore.__syanoDb
}

export const useDB = useDrizzle

/**
 * Gets database connection health status
 */
export function getConnectionHealth() {
  return {
    connected: !!globalStore.__syanoPool,
    attempts: globalStore.__syanoConnectionAttempts || 0,
    lastError: globalStore.__syanoLastConnectionError,
    poolSize: globalStore.__syanoPool?.totalCount || 0,
    idleConnections: globalStore.__syanoPool?.idleCount || 0,
    waitingClients: globalStore.__syanoPool?.waitingCount || 0,
  }
}
