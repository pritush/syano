import { defineEventHandler } from 'h3'
import { listTagsWithCounts } from '~/server/utils/tags'
import { requirePermission } from '~/server/utils/auth'
import { PERMISSIONS } from '~/shared/permissions'

export default defineEventHandler(async (event) => {
  await requirePermission(event, PERMISSIONS.LINKS_READ)
  return {
    items: await listTagsWithCounts(event),
  }
})

