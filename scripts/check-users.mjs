#!/usr/bin/env node

/**
 * Check Users in Database
 * Lists all users and helps create a default user if none exist
 */

import pg from 'pg'
import { readFileSync, existsSync } from 'fs'
import { hash } from 'bcryptjs'

const { Pool } = pg

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
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL
  }

  const envPath = '.env'
  if (!existsSync(envPath)) {
    log('❌ No .env file found', 'red')
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

  log('❌ DATABASE_URL not found in .env', 'red')
  process.exit(1)
}

async function checkUsers() {
  log('🔍 Checking users in database...', 'blue')
  log('')

  const databaseUrl = getDatabaseUrl()
  const pool = new Pool({ connectionString: databaseUrl })

  try {
    // Check if users table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      )
    `)

    if (!tableCheck.rows[0].exists) {
      log('❌ Users table does not exist', 'red')
      log('💡 Run database migrations:', 'yellow')
      log('   npm run db:push', 'cyan')
      process.exit(1)
    }

    // Get all users
    const result = await pool.query('SELECT id, username, display_name, is_active, permissions, created_at FROM users ORDER BY created_at')

    if (result.rows.length === 0) {
      log('⚠️  No users found in database', 'yellow')
      log('')
      log('💡 You need to create a user to login to the dashboard', 'yellow')
      log('')
      log('Would you like to create a default admin user?', 'cyan')
      log('   Username: admin', 'cyan')
      log('   Password: admin123', 'cyan')
      log('   Permissions: All permissions', 'cyan')
      log('')
      log('Run this command to create the user:', 'yellow')
      log('   node scripts/create-default-user.mjs', 'cyan')
      log('')
      process.exit(0)
    }

    log(`✅ Found ${result.rows.length} user(s):`, 'green')
    log('')

    result.rows.forEach((user, index) => {
      log(`${index + 1}. ${user.username}`, 'cyan')
      log(`   ID: ${user.id}`, 'cyan')
      log(`   Display Name: ${user.display_name || 'Not set'}`, 'cyan')
      log(`   Active: ${user.is_active ? 'Yes' : 'No'}`, 'cyan')
      log(`   Permissions: ${user.permissions.length} permission(s)`, 'cyan')
      log(`   Created: ${new Date(user.created_at).toLocaleString()}`, 'cyan')
      log('')
    })

    log('✅ Users table is populated', 'green')
    log('')
    log('💡 You can login with any of these users', 'yellow')
    log('   Dashboard: http://localhost:7466/dashboard/login', 'cyan')

  } catch (error) {
    log('❌ Error checking users:', 'red')
    log(`   ${error.message}`, 'red')
    process.exit(1)
  } finally {
    await pool.end()
  }
}

checkUsers().catch(error => {
  log(`❌ Unexpected error: ${error.message}`, 'red')
  process.exit(1)
})
