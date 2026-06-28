import { defineEventHandler } from 'h3'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { useDrizzle } from '~/server/utils/db'
import { requirePermission } from '~/server/utils/auth'
import { PERMISSIONS } from '~/shared/permissions'
import { join, resolve, dirname } from 'node:path'
import { existsSync } from 'node:fs'

function findDrizzleFolder(): string {
  // Start from current directory
  let currentDir = process.cwd()
  
  // Also check from import.meta.url if possible
  const possiblePaths = [
    join(process.cwd(), 'drizzle'),
    join(process.cwd(), '..', 'drizzle'),
    join(process.cwd(), '..', '..', 'drizzle'),
    // For .output/server/
    join(process.cwd(), '..', '..', '..', 'drizzle')
  ]

  for (const p of possiblePaths) {
    if (existsSync(join(p, 'meta', '_journal.json'))) {
      return p
    }
  }
  
  // Fallback to default
  return join(process.cwd(), 'drizzle')
}

export default defineEventHandler(async (event) => {
  await requirePermission(event, PERMISSIONS.DATA_MANAGE)
  
  try {
    const db = await useDrizzle(event)

    const migrationsFolder = findDrizzleFolder()
    
    try {
      await migrate(db, { migrationsFolder })
    } catch (migErr: any) {
      throw new Error(`Migration failed. Tried folder: ${migrationsFolder}. Original error: ${migErr.message}`)
    }

    return { success: true, message: 'Database schema upgraded successfully!' }
  } catch (err: any) {
    return { success: false, error: err.message || 'Unknown error occurred during migration.' }
  }
})
