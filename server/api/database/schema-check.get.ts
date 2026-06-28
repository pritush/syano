import { defineEventHandler } from 'h3'
import { useRuntimeConfig } from '#imports'
import { useDrizzle } from '~/server/utils/db'
import { requirePermission } from '~/server/utils/auth'
import { PERMISSIONS } from '~/shared/permissions'
import { checkSchema } from '~/server/utils/database-migrations'

export default defineEventHandler(async (event) => {
  await requirePermission(event, PERMISSIONS.DATA_MANAGE)

  let db
  try {
    db = await useDrizzle(event)
  } catch (err: any) {
    return {
      status: 'error',
      upToDate: false,
      missing: [],
      migrationVersion: 0,
      normalizeSlugsOnUpgrade: false,
      error: err.message || 'Unable to connect to database',
    }
  }

  try {
    const runtimeConfig = useRuntimeConfig(event)
    return await checkSchema(db, runtimeConfig.caseSensitive)
  } catch (err: any) {
    return {
      status: 'error',
      upToDate: false,
      missing: [],
      migrationVersion: 0,
      normalizeSlugsOnUpgrade: false,
      error: err.message,
    }
  }
})
