/**
 * Auto-detects if SSL should be enabled based on connection string.
 * Shared between server runtime (db.ts) and build-time (drizzle.config.ts).
 */

const CLOUD_PROVIDERS = [
  'supabase.co',
  'neon.tech',
  'aivencloud.com',
  'aws.com',
  'azure.com',
  'digitalocean.com',
  'heroku.com',
  'railway.app',
]

export function shouldUseSSL(connectionString: string): boolean {
  if (!connectionString) return false

  // Check for explicit sslmode in connection string
  if (connectionString.includes('sslmode=require') || connectionString.includes('sslmode=verify-')) {
    return true
  }

  if (connectionString.includes('sslmode=disable') || connectionString.includes('sslmode=prefer')) {
    return false
  }

  // Auto-detect cloud providers that require SSL
  return CLOUD_PROVIDERS.some(provider => connectionString.includes(provider))
}
