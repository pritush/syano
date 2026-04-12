import { defineEventHandler, setHeader } from 'h3'
import { getCompleteBackup } from '~/server/utils/backup'

export default defineEventHandler(async (event) => {
  const backup = await getCompleteBackup(event)
  
  setHeader(event, 'content-type', 'application/json; charset=utf-8')
  setHeader(event, 'content-disposition', `attachment; filename="syano-backup-${new Date().toISOString().split('T')[0]}.json"`)
  
  return backup
})
