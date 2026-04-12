#!/usr/bin/env node

/**
 * Database Connection Test Script
 * 
 * Tests database connectivity and displays connection information.
 * Usage: node scripts/test-db-connection.mjs
 */

import { Pool } from 'pg'
import { readFileSync, existsSync } from 'fs'

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function readDotEnv() {
  const envPath = '.env'
  
  if (!existsSync(envPath)) {
    return {}
  }

  const envRaw = readFileSync(envPath, 'utf8')
  const env = {}

  for (const line of envRaw.split(/\r?\n/)) {
    if (!line || /^\s*#/.test(line)) {
      continue
    }

    const index = line.indexOf('=')
    if (index === -1) {
      continue
    }

    const key = line.slice(0, index).trim()
    let value = line.slice(index + 1).trim()

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }

    env[key] = value
  }

  return env
}

function shouldUseSSL(connectionString) {
  if (!connectionString) return false
  
  if (connectionString.includes('sslmode=require') || connectionString.includes('sslmode=verify-')) {
    return true
  }

  if (connectionString.includes('sslmode=disable') || connectionString.includes('sslmode=prefer')) {
    return false
  }

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

function parseConnectionString(connectionString) {
  try {
    const url = new URL(connectionString)
    return {
      protocol: url.protocol.replace(':', ''),
      host: url.hostname,
      port: url.port || '5432',
      database: url.pathname.slice(1),
      username: url.username,
      hasPassword: !!url.password,
    }
  } catch {
    return null
  }
}

async function testConnection(connectionString) {
  const useSSL = shouldUseSSL(connectionString)
  
  const config = {
    connectionString,
    max: 1,
    connectionTimeoutMillis: 10000,
  }

  if (useSSL) {
    config.ssl = {
      rejectUnauthorized: false,
    }
  }

  const pool = new Pool(config)
  
  try {
    const startTime = Date.now()
    const client = await pool.connect()
    const connectTime = Date.now() - startTime

    const queryStart = Date.now()
    const result = await client.query('SELECT version(), current_database(), current_user')
    const queryTime = Date.now() - queryStart

    client.release()
    await pool.end()

    return {
      success: true,
      connectTime,
      queryTime,
      version: result.rows[0].version,
      database: result.rows[0].current_database,
      user: result.rows[0].current_user,
      ssl: useSSL,
    }
  } catch (error) {
    await pool.end()
    return {
      success: false,
      error: error.message,
      ssl: useSSL,
    }
  }
}

async function main() {
  log('\n╔════════════════════════════════════════════════════════════╗', 'cyan')
  log('║         Syano Database Connection Test                    ║', 'cyan')
  log('╚════════════════════════════════════════════════════════════╝\n', 'cyan')

  // Read environment variables
  const dotEnv = readDotEnv()
  const databaseUrl = 
    process.env.NUXT_DATABASE_URL || 
    process.env.DATABASE_URL || 
    dotEnv.NUXT_DATABASE_URL || 
    dotEnv.DATABASE_URL

  if (!databaseUrl) {
    log('✗ Error: DATABASE_URL not found', 'red')
    log('\nPlease set one of the following environment variables:', 'yellow')
    log('  - NUXT_DATABASE_URL', 'gray')
    log('  - DATABASE_URL', 'gray')
    log('\nOr add it to your .env file:', 'yellow')
    log('  NUXT_DATABASE_URL=postgresql://user:pass@host:5432/database\n', 'gray')
    process.exit(1)
  }

  // Parse connection string
  log('📋 Connection Details:', 'blue')
  log('─────────────────────────────────────────────────────────────', 'gray')
  
  const parsed = parseConnectionString(databaseUrl)
  if (parsed) {
    log(`  Protocol:  ${parsed.protocol}`, 'gray')
    log(`  Host:      ${parsed.host}`, 'gray')
    log(`  Port:      ${parsed.port}`, 'gray')
    log(`  Database:  ${parsed.database}`, 'gray')
    log(`  Username:  ${parsed.username}`, 'gray')
    log(`  Password:  ${parsed.hasPassword ? '***' : '(none)'}`, 'gray')
    log(`  SSL:       ${shouldUseSSL(databaseUrl) ? 'Enabled (auto-detected)' : 'Disabled'}`, 'gray')
  } else {
    log('  Unable to parse connection string', 'yellow')
  }

  log('\n🔌 Testing Connection...', 'blue')
  log('─────────────────────────────────────────────────────────────', 'gray')

  const result = await testConnection(databaseUrl)

  if (result.success) {
    log('✓ Connection successful!', 'green')
    log(`\n📊 Connection Stats:`, 'blue')
    log('─────────────────────────────────────────────────────────────', 'gray')
    log(`  Connect Time:  ${result.connectTime}ms`, 'gray')
    log(`  Query Time:    ${result.queryTime}ms`, 'gray')
    log(`  Total Time:    ${result.connectTime + result.queryTime}ms`, 'gray')
    
    log(`\n🗄️  Database Info:`, 'blue')
    log('─────────────────────────────────────────────────────────────', 'gray')
    log(`  Database:  ${result.database}`, 'gray')
    log(`  User:      ${result.user}`, 'gray')
    log(`  Version:   ${result.version.split(' ').slice(0, 2).join(' ')}`, 'gray')
    log(`  SSL:       ${result.ssl ? 'Enabled' : 'Disabled'}`, 'gray')

    log('\n✓ Database is ready for use!', 'green')
    log('\nNext steps:', 'yellow')
    log('  1. Run migrations: pnpm drizzle-kit migrate', 'gray')
    log('  2. Start the app:  pnpm dev', 'gray')
    log('  3. Check health:   curl http://localhost:3000/api/health\n', 'gray')
    
    process.exit(0)
  } else {
    log('✗ Connection failed!', 'red')
    log(`\n❌ Error Details:`, 'red')
    log('─────────────────────────────────────────────────────────────', 'gray')
    log(`  ${result.error}`, 'red')
    
    log('\n💡 Troubleshooting Tips:', 'yellow')
    log('─────────────────────────────────────────────────────────────', 'gray')
    
    if (result.error.includes('ECONNREFUSED')) {
      log('  • Database server is not running', 'gray')
      log('  • Check if PostgreSQL is started', 'gray')
      log('  • Verify host and port are correct', 'gray')
    } else if (result.error.includes('ETIMEDOUT')) {
      log('  • Connection timeout - check firewall settings', 'gray')
      log('  • Verify the host is reachable', 'gray')
      log('  • Check if your IP is whitelisted (cloud providers)', 'gray')
    } else if (result.error.includes('authentication failed')) {
      log('  • Username or password is incorrect', 'gray')
      log('  • Check your credentials', 'gray')
    } else if (result.error.includes('database') && result.error.includes('does not exist')) {
      log('  • Database does not exist', 'gray')
      log('  • Create the database first: createdb syano', 'gray')
    } else if (result.error.includes('SSL')) {
      log('  • SSL configuration issue', 'gray')
      log('  • Try adding ?sslmode=require to connection string', 'gray')
      log('  • Or set NUXT_DB_SSL=true', 'gray')
    } else {
      log('  • Check your connection string format', 'gray')
      log('  • Ensure PostgreSQL is accessible', 'gray')
      log('  • Review database logs for more details', 'gray')
    }

    log('\n📚 Documentation:', 'yellow')
    log('  • Setup Guide:    SETUP.md', 'gray')
    log('  • Database Guide: docs/DATABASE_SETUP.md', 'gray')
    log('  • Features:       docs/DATABASE_FEATURES.md\n', 'gray')
    
    process.exit(1)
  }
}

main().catch((error) => {
  log(`\n✗ Unexpected error: ${error.message}`, 'red')
  process.exit(1)
})
