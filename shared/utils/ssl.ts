/**
 * Auto-detects if SSL should be enabled based on connection string.
 * Shared between server runtime (db.ts) and build-time (drizzle.config.ts).
 */

const CLOUD_PROVIDERS = [
  'supabase.co',
  'supabase.com',
  'supabase.net',
  'neon.tech',
  'neon.build',
  'aivencloud.com',
  'aws.com',
  'azure.com',
  'digitalocean.com',
  'heroku.com',
  'railway.app',
  'render.com',
  'koyeb.app',
  'fly.dev',
  'tembo.io',
]

export function shouldUseSSL(connectionString: string): boolean {
  if (!connectionString) return false

  const lower = connectionString.toLowerCase()

  // Explicit disable flags
  if (lower.includes('sslmode=disable') || lower.includes('ssl=false') || lower.includes('ssl=0')) {
    return false
  }

  // Check for explicit sslmode or ssl in connection string
  if (
    lower.includes('sslmode=require') ||
    lower.includes('sslmode=verify-') ||
    lower.includes('sslmode=prefer') ||
    lower.includes('ssl=true') ||
    lower.includes('ssl=1')
  ) {
    return true
  }

  // Auto-detect cloud providers or poolers that require SSL
  return (
    CLOUD_PROVIDERS.some(provider => lower.includes(provider)) ||
    lower.includes('pooler.')
  )
}
