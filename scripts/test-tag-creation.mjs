#!/usr/bin/env node
/**
 * Test tag creation functionality
 */

import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import pg from 'pg'
import crypto from 'node:crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function testTagCreation() {
  try {
    const databaseUrl = process.env.NUXT_DATABASE_URL
    
    if (!databaseUrl) {
      console.error('❌ NUXT_DATABASE_URL not found in environment')
      process.exit(1)
    }

    console.log('🔌 Connecting to database...')
    const pool = new pg.Pool({ connectionString: databaseUrl })

    // Check if tags table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'tags'
      );
    `)
    
    if (!tableCheck.rows[0].exists) {
      console.error('❌ tags table does not exist')
      await pool.end()
      process.exit(1)
    }

    console.log('✅ tags table exists')

    // Check table structure
    const structureCheck = await pool.query(`
      SELECT column_name, data_type, character_maximum_length, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'tags'
      ORDER BY ordinal_position;
    `)
    
    console.log('\n📋 Table structure:')
    structureCheck.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`)
    })

    // Count existing tags
    const countResult = await pool.query('SELECT COUNT(*) as count FROM tags')
    console.log(`\n📊 Total tags in database: ${countResult.rows[0].count}`)

    // List existing tags
    const tagsResult = await pool.query('SELECT id, name, created_at FROM tags ORDER BY created_at DESC LIMIT 10')
    
    if (tagsResult.rows.length > 0) {
      console.log('\n🏷️  Existing tags:')
      tagsResult.rows.forEach((tag, idx) => {
        console.log(`  ${idx + 1}. ${tag.name} (ID: ${tag.id})`)
      })
    } else {
      console.log('\n⚠️  No tags found in database')
    }

    // Test tag insertion
    console.log('\n🧪 Testing manual tag insertion...')
    const testTagName = `Test Tag ${Date.now()}`
    const testTagId = crypto.randomUUID()
    
    try {
      const insertResult = await pool.query(
        'INSERT INTO tags (id, name) VALUES ($1, $2) RETURNING *',
        [testTagId, testTagName]
      )
      
      if (insertResult.rows.length > 0) {
        console.log('✅ Manual tag insertion successful!')
        console.log('   Created:', insertResult.rows[0])
        
        // Clean up test tag
        await pool.query('DELETE FROM tags WHERE id = $1', [testTagId])
        console.log('🧹 Test tag cleaned up')
      }
    } catch (error) {
      console.error('❌ Manual tag insertion failed:', error.message)
    }

    // Check for any constraints
    const constraintsCheck = await pool.query(`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'tags';
    `)
    
    console.log('\n🔒 Table constraints:')
    constraintsCheck.rows.forEach(constraint => {
      console.log(`  - ${constraint.constraint_name}: ${constraint.constraint_type}`)
    })

    await pool.end()
    console.log('\n✅ Test completed')

  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error(error)
    process.exit(1)
  }
}

testTagCreation()
