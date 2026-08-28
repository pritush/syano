import { defineConfig } from 'drizzle-kit'
import { shouldUseSSL } from './shared/utils/ssl'

// Read environment from NODE_ENV or default to development
const environment = process.env.NODE_ENV || 'development'

// Determine database URL based on environment
const databaseUrl = process.env.NUXT_DATABASE_URL || process.env.DATABASE_URL || ''


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


