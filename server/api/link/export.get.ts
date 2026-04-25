import { defineEventHandler, setHeader } from 'h3'
import { exportLinks } from '~/server/utils/link-store'
import { requirePermission } from '~/server/utils/auth'
import { PERMISSIONS } from '~/shared/permissions'

export default defineEventHandler(async (event) => {
  await requirePermission(event, PERMISSIONS.LINKS_READ)
  setHeader(event, 'content-type', 'application/json; charset=utf-8')

  return {
    exported_at: new Date().toISOString(),
    items: await exportLinks(event),
  }
})

