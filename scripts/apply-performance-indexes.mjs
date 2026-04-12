#!/usr/bin/env node

/**
 * Apply Performance Indexes Script
 * 
 * This script applies the new performance indexes to an existing database.
 * Run this after upgrading to ensure optimal query performance.
 * 
 * Usage:
 *   npm run db:indexes
 *   or
 *   node scripts/apply-performance-indexes.mjs
 */

import { Pool } from 'pg'
import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables
config({ path: resolve(process.cwd(), '.env') })

const indexes = [
  {
    name: 'idx_access_logs_link_created',
    sql: 'CREATE INDEX IF NOT EXISTS idx_access_logs_link_created ON access_logs(link_id, created_at DESC)',
    description: 'Composite index for link analytics queries',
  },
  {
    name: 'idx_access_logs_slug_created',
    sql: 'CREATE INDEX IF NOT EXISTS idx_access_logs_slug_created ON access_logs(slug, created_at DESC)',
    description: 'Composite index for slug-based analytics',
  },
  {
    name: 'idx_links_tag_created',
    sql: 'CREATE INDEX IF NOT EXISTS idx_links_tag_created ON links(tag_id, created_at DESC)',
    description: 'Composite index for tag filtering',
  },
  {
    name: 'idx_links_active',
    sql: `CREATE INDEX IF NOT EXISTS idx_links_active ON links(created_at DESC) 
          WHERE expiration IS NULL OR expiration > EXTRACT(EPOCH FROM NOW()) * 1000`,
    description: 'Partial index for active links',
  },
]

async function applyIndexes() {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    console.error('❌ Error: DATABASE_URL environment variable is not set')
    console.error('   Please set DATABASE_URL in your .env file')
    process.exit(1)
  }

  console.log('🔗 Connecting to database...')
  
  const pool = new Pool({
    connectionString,
    ssl: connectionString.includes('sslmode=require') || 
         connectionString.includes('.supabase.') ||
         connectionString.includes('.neon.') ||
         connectionString.includes('.aiven.')
      ? { rejectUnauthorized: false }
      : false,
  })

  try {
    // Test connection
    await pool.query('SELECT NOW()')
    console.log('✅ Connected to database\n')

    console.log('📊 Applying performance indexes...\n')

    for (const index of indexes) {
      try {
        console.log(`⏳ Creating ${index.name}...`)
        console.log(`   ${index.description}`)
        
        const startTime = Date.now()
        await pool.query(index.sql)
        const duration = Date.now() - startTime
        
        console.log(`✅ Created ${index.name} (${duration}ms)\n`)
      } catch (error) {
        console.error(`❌ Failed to create ${index.name}:`, error.message)
        console.error(`   SQL: ${index.sql}\n`)
      }
    }

    // Verify indexes
    console.log('🔍 Verifying indexes...')
    const result = await pool.query(`
      SELECT 
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname LIKE 'idx_%'
      ORDER BY tablename, indexname
    `)

    console.log(`\n✅ Found ${result.rows.length} indexes:\n`)
    
    const groupedIndexes = result.rows.reduce((acc, row) => {
      if (!acc[row.tablename]) {
        acc[row.tablename] = []
      }
      acc[row.tablename].push(row.indexname)
      return acc
    }, {})

    for (const [table, indexNames] of Object.entries(groupedIndexes)) {
      console.log(`📋 ${table}:`)
      indexNames.forEach(name => console.log(`   - ${name}`))
      console.log()
    }

    console.log('✅ All performance indexes applied successfully!')
    console.log('\n💡 Tip: Run ANALYZE on your tables to update statistics:')
    console.log('   ANALYZE links;')
    console.log('   ANALYZE access_logs;')

  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

// Run the script
applyIndexes().catch(error => {
  console.error('❌ Unexpected error:', error)
  process.exit(1)
})
