#!/usr/bin/env node
/**
 * Test QR tracking functionality
 */

import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import pg from 'pg'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
const envPath = resolve(__dirname, '../.env')
console.log('Loading environment from:', envPath)

async function testQrTracking() {
  try {
    // Get database URL from environment
    const databaseUrl = process.env.NUXT_DATABASE_URL
    
    if (!databaseUrl) {
      console.error('❌ NUXT_DATABASE_URL not found in environment')
      process.exit(1)
    }

    console.log('🔌 Connecting to database...')
    const pool = new pg.Pool({ connectionString: databaseUrl })

    // Check if qr_scans table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'qr_scans'
      );
    `)
    
    if (!tableCheck.rows[0].exists) {
      console.error('❌ qr_scans table does not exist')
      await pool.end()
      process.exit(1)
    }

    console.log('✅ qr_scans table exists')

    // Count total QR scans
    const countResult = await pool.query('SELECT COUNT(*) as count FROM qr_scans')
    console.log(`📊 Total QR scans in database: ${countResult.rows[0].count}`)

    // Get recent QR scans
    const recentScans = await pool.query(`
      SELECT 
        qs.id,
        qs.slug,
        qs.link_id,
        qs.created_at,
        l.url
      FROM qr_scans qs
      LEFT JOIN links l ON l.id = qs.link_id
      ORDER BY qs.created_at DESC
      LIMIT 10
    `)

    if (recentScans.rows.length > 0) {
      console.log('\n📋 Recent QR scans:')
      recentScans.rows.forEach((scan, idx) => {
        console.log(`  ${idx + 1}. Slug: ${scan.slug} | Link ID: ${scan.link_id} | Time: ${scan.created_at}`)
        console.log(`     URL: ${scan.url || 'N/A'}`)
      })
    } else {
      console.log('\n⚠️  No QR scans found in database')
      console.log('\nTo test:')
      console.log('1. Visit a QR code URL with ?r=qr parameter')
      console.log('2. Example: http://localhost:7466/yourslug?r=qr')
    }

    // Check for links to test with
    const linksResult = await pool.query('SELECT slug FROM links LIMIT 5')
    if (linksResult.rows.length > 0) {
      console.log('\n💡 Test QR tracking with these URLs:')
      linksResult.rows.forEach(link => {
        console.log(`   http://localhost:7466/${link.slug}?r=qr`)
      })
    }

    await pool.end()
    console.log('\n✅ Test completed')

  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

testQrTracking()
