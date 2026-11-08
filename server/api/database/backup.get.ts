import { defineEventHandler, getQuery, setHeader } from 'h3'
import { getCompleteBackup } from '~/server/utils/backup'
import { requirePermission } from '~/server/utils/auth'
import { PERMISSIONS } from '~/shared/permissions'

export default defineEventHandler(async (event) => {
  await requirePermission(event, PERMISSIONS.DATA_MANAGE)
  
  const query = getQuery(event)
  const maxLogs = query.max_logs !== undefined ? parseInt(String(query.max_logs), 10) : 10000
  const includeLogs = query.include_logs !== 'false'

  const backup = await getCompleteBackup(event, { maxLogs, includeLogs })
  
  setHeader(event, 'content-type', 'application/json; charset=utf-8')
  setHeader(event, 'content-disposition', `attachment; filename="syano-backup-${new Date().toISOString().split('T')[0]}.json"`)
  
  return backup
})
