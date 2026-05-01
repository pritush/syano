#!/usr/bin/env node

/**
 * API Endpoint Tester
 * Tests if the V1 API endpoints are working correctly
 */

import { readFileSync, existsSync } from 'fs'

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

function getAuthToken() {
  // Try to read from .env file
  const envPath = '.env'
  if (!existsSync(envPath)) {
    return null
  }

  const envContent = readFileSync(envPath, 'utf-8')
  const lines = envContent.split('\n')
  
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('NUXT_SITE_TOKEN=')) {
      return trimmed.substring('NUXT_SITE_TOKEN='.length).trim()
    }
  }

  return null
}

async function testEndpoint(name, url, token) {
  try {
    log(`⏳ Testing ${name}...`, 'yellow')
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (!response.ok) {
      log(`❌ ${name} failed: ${response.status} ${response.statusText}`, 'red')
      const text = await response.text()
      log(`   Response: ${text.substring(0, 200)}`, 'red')
      return false
    }

    const data = await response.json()
    log(`✅ ${name} successful`, 'green')
    
    if (data.data && Array.isArray(data.data)) {
      log(`   Found ${data.data.length} items`, 'cyan')
    }
    
    return true
  } catch (error) {
    log(`❌ ${name} error: ${error.message}`, 'red')
    return false
  }
}

async function main() {
  log('🔍 Testing API Endpoints...', 'blue')
  log('')

  const baseUrl = 'http://localhost:7466'
  const token = getAuthToken()

  if (!token) {
    log('❌ No NUXT_SITE_TOKEN found in .env', 'red')
    log('💡 Add NUXT_SITE_TOKEN to your .env file', 'yellow')
    process.exit(1)
  }

  log(`📋 Using token: ${token.substring(0, 10)}...`, 'cyan')
  log('')

  const tests = [
    { name: 'GET /api/v1/links', url: `${baseUrl}/api/v1/links` },
    { name: 'GET /api/v1/tags', url: `${baseUrl}/api/v1/tags` },
    { name: 'GET /api/v1/analytics/counters', url: `${baseUrl}/api/v1/analytics/counters` },
  ]

  let passed = 0
  let failed = 0

  for (const test of tests) {
    const result = await testEndpoint(test.name, test.url, token)
    if (result) {
      passed++
    } else {
      failed++
    }
    log('')
  }

  log('📊 Test Results:', 'blue')
  log(`   Passed: ${passed}`, 'green')
  log(`   Failed: ${failed}`, failed > 0 ? 'red' : 'green')
  log('')

  if (failed > 0) {
    log('💡 Possible issues:', 'yellow')
    log('   1. Dev server not running (npm run dev)', 'cyan')
    log('   2. Authentication token incorrect', 'cyan')
    log('   3. Database not connected', 'cyan')
    log('   4. No data in database', 'cyan')
    process.exit(1)
  }

  log('✅ All API endpoints working!', 'green')
}

main().catch(error => {
  log(`❌ Unexpected error: ${error.message}`, 'red')
  process.exit(1)
})
