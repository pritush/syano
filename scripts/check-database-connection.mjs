#!/usr/bin/env node

/**
 * Database Connection Checker
 * 
 * This script checks if the database is accessible and provides
 * helpful diagnostics if there are connection issues.
 */

import pg from 'pg'
import { readFileSync, existsSync } from 'fs'

const { Pool } = pg

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function getDatabaseUrl() {
  // Check environment variable first
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL
  }

  // Try to read from .env file
  const envPath = '.env'
  if (!existsSync(envPath)) {
    log('❌ No .env file found and no DATABASE_URL environment variable set', 'red')
    log('\n💡 Create a .env file with:', 'yellow')
    log('   DATABASE_URL=postgresql://username:password@localhost:5432/database', 'cyan')
    process.exit(1)
  }

  const envContent = readFileSync(envPath, 'utf-8')
  const lines = envContent.split('\n')
  
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('DATABASE_URL=')) {
      return trimmed.substring('DATABASE_URL='.length).trim()
    }
  }

  log('❌ DATABASE_URL not found in .env file', 'red')
  log('\n💡 Add this line to your .env file:', 'yellow')
  log('   DATABASE_URL=postgresql://username:password@localhost:5432/database', 'cyan')
  process.exit(1)
}

function parseDatabaseUrl(url) {
  try {
    const match = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/)
    if (!match) {
      throw new Error('Invalid DATABASE_URL format')
    }
    
    return {
      user: match[1],
      password: match[2],
      host: match[3],
      port: parseInt(match[4]),
      database: match[5],
    }
  } catch (error) {
    log('❌ Invalid DATABASE_URL format', 'red')
    log('\n💡 Expected format:', 'yellow')
    log('   postgresql://username:password@host:port/database', 'cyan')
    log('\n   Example:', 'yellow')
    log('   postgresql://postgres:mypassword@localhost:5432/mydb', 'cyan')
    process.exit(1)
  }
}

async function checkDatabaseConnection() {
  log('🔍 Checking database connection...', 'blue')
  log('')

  const databaseUrl = getDatabaseUrl()
  const config = parseDatabaseUrl(databaseUrl)

  log('📋 Connection Details:', 'cyan')
  log(`   Host: ${config.host}`, 'cyan')
  log(`   Port: ${config.port}`, 'cyan')
  log(`   Database: ${config.database}`, 'cyan')
  log(`   User: ${config.user}`, 'cyan')
  log(`   Password: ${'*'.repeat(config.password.length)}`, 'cyan')
  log('')

  const pool = new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5000,
  })

  try {
    log('⏳ Attempting to connect...', 'yellow')
    
    const client = await pool.connect()
    log('✅ Successfully connected to database!', 'green')
    log('')

    // Test query
    log('⏳ Running test query...', 'yellow')
    const result = await client.query('SELECT NOW() as current_time, version() as pg_version')
    log('✅ Test query successful!', 'green')
    log('')

    log('📊 Database Info:', 'cyan')
    log(`   Current Time: ${result.rows[0].current_time}`, 'cyan')
    log(`   PostgreSQL Version: ${result.rows[0].pg_version.split(',')[0]}`, 'cyan')
    log('')

    // Check if tables exist
    log('⏳ Checking database schema...', 'yellow')
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `)

    if (tablesResult.rows.length === 0) {
      log('⚠️  No tables found in database', 'yellow')
      log('\n💡 You may need to run migrations:', 'yellow')
      log('   npm run db:push', 'cyan')
      log('   or', 'yellow')
      log('   npm run db:migrate', 'cyan')
    } else {
      log(`✅ Found ${tablesResult.rows.length} tables:`, 'green')
      tablesResult.rows.forEach(row => {
        log(`   - ${row.table_name}`, 'cyan')
      })
    }

    client.release()
    log('')
    log('✅ Database connection is working correctly!', 'green')
    log('')

  } catch (error) {
    log('❌ Database connection failed!', 'red')
    log('')
    log('Error Details:', 'red')
    log(`   ${error.message}`, 'red')
    log('')

    // Provide helpful diagnostics
    if (error.code === 'ECONNREFUSED') {
      log('💡 Possible Solutions:', 'yellow')
      log('   1. Make sure PostgreSQL is installed and running', 'cyan')
      log('   2. Check if PostgreSQL is listening on the correct port', 'cyan')
      log('   3. Verify the host and port in your DATABASE_URL', 'cyan')
      log('')
      log('   To check PostgreSQL status:', 'yellow')
      log('   - Windows: Check Services for "postgresql" service', 'cyan')
      log('   - Mac: brew services list | grep postgresql', 'cyan')
      log('   - Linux: sudo systemctl status postgresql', 'cyan')
    } else if (error.code === 'ENOTFOUND') {
      log('💡 Possible Solutions:', 'yellow')
      log('   1. Check the hostname in your DATABASE_URL', 'cyan')
      log('   2. Make sure you can reach the database server', 'cyan')
      log('   3. Verify your network connection', 'cyan')
    } else if (error.code === '28P01') {
      log('💡 Possible Solutions:', 'yellow')
      log('   1. Check your database username and password', 'cyan')
      log('   2. Verify the credentials in your .env file', 'cyan')
      log('   3. Make sure the user has access to the database', 'cyan')
    } else if (error.code === '3D000') {
      log('💡 Possible Solutions:', 'yellow')
      log('   1. The database does not exist', 'cyan')
      log('   2. Create the database first:', 'cyan')
      log('      psql -U postgres -c "CREATE DATABASE your_database_name"', 'cyan')
    } else if (error.code === 'ETIMEDOUT') {
      log('💡 Possible Solutions:', 'yellow')
      log('   1. Connection timed out - check firewall settings', 'cyan')
      log('   2. Verify PostgreSQL is accepting connections', 'cyan')
      log('   3. Check pg_hba.conf for connection permissions', 'cyan')
    }

    log('')
    process.exit(1)
  } finally {
    await pool.end()
  }
}

// Run the check
checkDatabaseConnection().catch(error => {
  log('❌ Unexpected error:', 'red')
  log(`   ${error.message}`, 'red')
  process.exit(1)
})
