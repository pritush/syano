#!/usr/bin/env node

/**
 * Check if audit_logs table exists and create it if missing
 * Run: node scripts/check-audit-logs-table.mjs
 */

import { readFileSync, existsSync } from 'node:fs'
import pg from 'pg'

const { Pool } = pg

// Read database URL from environment or .env file
function getDatabaseUrl() {
  // Try environment variables first
  if (process.env.NUXT_DATABASE_URL) {
    return process.env.NUXT_DATABASE_URL
  }
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL
  }

  // Try reading from .env file
  const envPath = '.env'
  if (!existsSync(envPath)) {
    console.error('❌ No .env file found and no DATABASE_URL environment variable set')
    process.exit(1)
  }

  const envRaw = readFileSync(envPath, 'utf8')
  for (const line of envRaw.split(/\r?\n/)) {
    if (!line || /^\s*#/.test(line)) continue

    const index = line.indexOf('=')
    if (index === -1) continue

    const key = line.slice(0, index).trim()
    if (key !== 'NUXT_DATABASE_URL' && key !== 'DATABASE_URL') continue

    let value = line.slice(index + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }

    if (value) return value
  }

  console.error('❌ DATABASE_URL not found in .env file')
  process.exit(1)
}

async function checkAndCreateAuditLogsTable() {
  const databaseUrl = getDatabaseUrl()
  console.log('🔍 Checking audit_logs table...')

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('neon.tech') || databaseUrl.includes('supabase.co')
      ? { rejectUnauthorized: false }
      : undefined,
  })

  try {
    // Check if table exists
    const checkResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'audit_logs'
      );
    `)

    const tableExists = checkResult.rows[0].exists

    if (tableExists) {
      console.log('✅ audit_logs table already exists')
      
      // Check row count
      const countResult = await pool.query('SELECT COUNT(*) as count FROM audit_logs')
      const count = parseInt(countResult.rows[0].count)
      console.log(`📊 Current audit log entries: ${count}`)
      
      return
    }

    console.log('⚠️  audit_logs table does not exist. Creating...')

    // Enable uuid-ossp extension if not already enabled
    try {
      await pool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";')
      console.log('✅ uuid-ossp extension enabled')
    } catch (extError) {
      console.warn('⚠️  Could not enable uuid-ossp extension (may already exist or lack permissions)')
    }

    // Create the table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        actor_id VARCHAR(64) NOT NULL,
        actor_username VARCHAR(128) NOT NULL,
        action VARCHAR(32) NOT NULL,
        entity_type VARCHAR(32) NOT NULL,
        entity_id VARCHAR(128),
        entity_label VARCHAR(256),
        details JSONB,
        ip INET,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `)

    // Create indexes for better query performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
    `)
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs(actor_id);
    `)
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
    `)
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type);
    `)

    console.log('✅ audit_logs table created successfully')
    console.log('✅ Indexes created for optimal performance')

  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

checkAndCreateAuditLogsTable()
