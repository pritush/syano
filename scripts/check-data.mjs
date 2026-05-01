#!/usr/bin/env node

/**
 * Check Data in Database
 * Shows counts of links, tags, and other data
 */

import pg from 'pg'
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

async function checkData() {
  log('🔍 Checking data in database...', 'blue')
  log('')

  const databaseUrl = getDatabaseUrl()
  const pool = new Pool({ connectionString: databaseUrl })

  try {
    // Get counts
    const tables = [
      { name: 'links', label: 'Links' },
      { name: 'tags', label: 'Tags' },
      { name: 'users', label: 'Users' },
      { name: 'access_logs', label: 'Access Logs' },
      { name: 'api_keys', label: 'API Keys' },
      { name: 'webhooks', label: 'Webhooks' },
      { name: 'audit_logs', label: 'Audit Logs' },
    ]

    log('📊 Data Counts:', 'cyan')
    log('')

    for (const table of tables) {
      const result = await pool.query(`SELECT COUNT(*)::int as count FROM ${table.name}`)
      const count = result.rows[0].count
      const color = count > 0 ? 'green' : 'yellow'
      log(`   ${table.label}: ${count}`, color)
    }

    log('')

    // Get sample links
    const linksResult = await pool.query('SELECT slug, url, created_at FROM links ORDER BY created_at DESC LIMIT 5')
    
    if (linksResult.rows.length > 0) {
      log('📎 Recent Links:', 'cyan')
      log('')
      linksResult.rows.forEach((link, index) => {
        log(`   ${index + 1}. /${link.slug}`, 'cyan')
        log(`      URL: ${link.url.substring(0, 60)}${link.url.length > 60 ? '...' : ''}`, 'cyan')
        log(`      Created: ${new Date(link.created_at).toLocaleString()}`, 'cyan')
        log('')
      })
    } else {
      log('⚠️  No links found in database', 'yellow')
      log('')
      log('💡 Create some links to see them in the dashboard', 'yellow')
      log('   1. Login to dashboard: http://localhost:7466/dashboard/login', 'cyan')
      log('   2. Go to Links page', 'cyan')
      log('   3. Click "Create Link"', 'cyan')
      log('')
    }

  } catch (error) {
    log('❌ Error checking data:', 'red')
    log(`   ${error.message}`, 'red')
    process.exit(1)
  } finally {
    await pool.end()
  }
}

checkData().catch(error => {
  log(`❌ Unexpected error: ${error.message}`, 'red')
  process.exit(1)
})
