import { defineEventHandler } from 'h3'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { useDrizzle } from '~/server/utils/db'
import { requirePermission } from '~/server/utils/auth'
import { PERMISSIONS } from '~/shared/permissions'
import { join } from 'node:path'

export default defineEventHandler(async (event) => {
  await requirePermission(event, PERMISSIONS.DATA_MANAGE)
  
  try {
    const db = await useDrizzle(event)

    // The migrations folder is located in the root of the project
    // In production (Vercel/Nitro), it should be bundled and available via process.cwd()
    const migrationsFolder = join(process.cwd(), 'drizzle')

    await migrate(db, { migrationsFolder })

    return { success: true, message: 'Database schema upgraded successfully!' }
  } catch (err: any) {
    return { success: false, error: err.message || 'Unknown error occurred during migration.' }
  }
})
