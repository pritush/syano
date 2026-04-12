import { defineConfig } from 'drizzle-kit'

// Read environment from NODE_ENV or default to development
const environment = process.env.NODE_ENV || 'development'

// Determine database URL based on environment
const databaseUrl = process.env.NUXT_DATABASE_URL || process.env.DATABASE_URL || ''

// Auto-detect if SSL should be enabled
function shouldUseSSL(connectionString: string): boolean {
  if (!connectionString) return false
  
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

// Build database credentials with SSL support
const dbCredentials: any = {
  url: databaseUrl,
}

// Add SSL configuration if needed
if (shouldUseSSL(databaseUrl)) {
  dbCredentials.ssl = {
    rejectUnauthorized: false, // Allow self-signed certificates
  }
}

export default defineConfig({
  schema: './server/database/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials,
  verbose: environment === 'development', // Enable verbose logging in development
  strict: true, // Enable strict mode for better type safety
})


