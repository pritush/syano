import { defineEventHandler, setResponseStatus } from 'h3'
import { useRuntimeConfig } from '#imports'
import { useDrizzle } from '~/server/utils/db'
import { requirePermission } from '~/server/utils/auth'
import { PERMISSIONS } from '~/shared/permissions'
import {
  acquireUpgradeLock,
  releaseUpgradeLock,
  runDatabaseUpgrade,
} from '~/server/utils/database-migrations'

export default defineEventHandler(async (event) => {
  await requirePermission(event, PERMISSIONS.DATA_MANAGE)

  acquireUpgradeLock()

  try {
    const db = await useDrizzle(event)
    const runtimeConfig = useRuntimeConfig(event)
    const result = await runDatabaseUpgrade(db, runtimeConfig.caseSensitive)
    return result
  } catch (err: any) {
    const statusCode = err.statusCode || 500
    setResponseStatus(event, statusCode)
    return {
      success: false,
      error: err.statusMessage || err.message || 'Unknown error occurred during migration.',
      migrationVersion: 0,
    }
  } finally {
    releaseUpgradeLock()
  }
})
