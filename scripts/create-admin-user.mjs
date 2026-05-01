#!/usr/bin/env node

/**
 * Create Admin User
 * Creates a default admin user with all permissions
 */

import pg from 'pg'
import { hash } from 'bcryptjs'
import { readFileSync, existsSync } from 'fs'

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

async function createAdminUser() {
  log('🔧 Creating admin user...', 'blue')
  log('')

  const databaseUrl = getDatabaseUrl()
  const pool = new Pool({ connectionString: databaseUrl })

  try {
    // Check if admin user already exists
    const existing = await pool.query('SELECT id, username FROM users WHERE username = $1', ['admin'])
    
    if (existing.rows.length > 0) {
      log('⚠️  User "admin" already exists', 'yellow')
      log('   If you want to reset the password, delete the user first:', 'yellow')
      log(`   DELETE FROM users WHERE username = 'admin';`, 'cyan')
      log('')
      process.exit(1)
    }

    // Create admin user
    log('⏳ Hashing password...', 'yellow')
    const passwordHash = await hash('admin123', 10)
    
    log('⏳ Creating user with all permissions...', 'yellow')
    const permissions = [
      'links:read',
      'links:write',
      'links:delete',
      'analytics:read',
      'tags:manage',
      'settings:manage',
      'users:manage',
      'api_keys:manage',
      'webhooks:manage',
    ]

    const result = await pool.query(`
      INSERT INTO users (username, display_name, password_hash, permissions, is_active)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, username, display_name
    `, ['admin', 'Administrator', passwordHash, permissions, true])

    const user = result.rows[0]

    log('✅ Admin user created successfully!', 'green')
    log('')
    log('📋 User Details:', 'cyan')
    log(`   ID: ${user.id}`, 'cyan')
    log(`   Username: ${user.username}`, 'cyan')
    log(`   Display Name: ${user.display_name}`, 'cyan')
    log(`   Permissions: ${permissions.length} permissions`, 'cyan')
    log('')
    log('🔑 Login Credentials:', 'green')
    log('   Username: admin', 'green')
    log('   Password: admin123', 'green')
    log('')
    log('🔗 Login URL:', 'cyan')
    log('   http://localhost:7466/dashboard/login', 'cyan')
    log('')
    log('⚠️  IMPORTANT: Change the password after first login!', 'yellow')
    log('   Go to Settings > Users to change the password', 'yellow')
    log('')

  } catch (error) {
    log('❌ Error creating admin user:', 'red')
    log(`   ${error.message}`, 'red')
    process.exit(1)
  } finally {
    await pool.end()
  }
}

createAdminUser().catch(error => {
  log(`❌ Unexpected error: ${error.message}`, 'red')
  process.exit(1)
})
