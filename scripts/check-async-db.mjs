#!/usr/bin/env node

/**
 * Check for missing await on async database functions
 * 
 * This script scans for usages of useDrizzle(), useDB(), and usePool()
 * without await to catch potential bugs.
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

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

function getAllFiles(dir, fileList = []) {
  const files = readdirSync(dir)

  files.forEach(file => {
    const filePath = join(dir, file)
    const stat = statSync(filePath)

    if (stat.isDirectory()) {
      if (!file.startsWith('.') && file !== 'node_modules') {
        getAllFiles(filePath, fileList)
      }
    } else if (file.endsWith('.ts') || file.endsWith('.js')) {
      fileList.push(filePath)
    }
  })

  return fileList
}

function checkFile(filePath) {
  const content = readFileSync(filePath, 'utf8')
  const lines = content.split('\n')
  const issues = []

  // Patterns to check
  const patterns = [
    { regex: /const\s+\w+\s*=\s*useDrizzle\s*\(/g, name: 'useDrizzle' },
    { regex: /const\s+\w+\s*=\s*useDB\s*\(/g, name: 'useDB' },
    { regex: /const\s+\w+\s*=\s*usePool\s*\(/g, name: 'usePool' },
  ]

  patterns.forEach(({ regex, name }) => {
    let match
    while ((match = regex.exec(content)) !== null) {
      const lineNumber = content.substring(0, match.index).split('\n').length
      const line = lines[lineNumber - 1]

      // Check if 'await' is present before the function call
      if (!line.includes('await')) {
        issues.push({
          line: lineNumber,
          text: line.trim(),
          function: name,
        })
      }
    }
  })

  return issues
}

function main() {
  log('\n╔════════════════════════════════════════════════════════════╗', 'cyan')
  log('║         Async Database Function Checker                   ║', 'cyan')
  log('╚════════════════════════════════════════════════════════════╝\n', 'cyan')

  log('Scanning server files for missing await...', 'blue')
  log('─────────────────────────────────────────────────────────────\n', 'gray')

  const serverFiles = getAllFiles('server')
  let totalIssues = 0
  const filesWithIssues = []

  serverFiles.forEach(file => {
    const issues = checkFile(file)
    if (issues.length > 0) {
      totalIssues += issues.length
      filesWithIssues.push({ file, issues })
    }
  })

  if (totalIssues === 0) {
    log('✓ No issues found!', 'green')
    log('\nAll database functions are properly awaited.', 'gray')
    log('\nChecked functions:', 'blue')
    log('  • useDrizzle()', 'gray')
    log('  • useDB()', 'gray')
    log('  • usePool()\n', 'gray')
    process.exit(0)
  }

  log(`✗ Found ${totalIssues} potential issue(s) in ${filesWithIssues.length} file(s):\n`, 'red')

  filesWithIssues.forEach(({ file, issues }) => {
    log(`📄 ${file}`, 'yellow')
    issues.forEach(issue => {
      log(`   Line ${issue.line}: Missing 'await' for ${issue.function}()`, 'red')
      log(`   ${issue.text}`, 'gray')
    })
    log('', 'reset')
  })

  log('💡 Fix:', 'yellow')
  log('   Add "await" before the function call:', 'gray')
  log('   const db = await useDrizzle(event)', 'green')
  log('   const pool = await usePool(event)\n', 'green')

  process.exit(1)
}

main()
