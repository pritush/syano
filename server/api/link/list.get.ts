import { createError, defineEventHandler, getQuery } from 'h3'
import { listLinksQuerySchema } from '~/shared/schemas/link'
import { listLinks } from '~/server/utils/link-store'
import { requirePermission } from '~/server/utils/auth'
import { PERMISSIONS } from '~/shared/permissions'

export default defineEventHandler(async (event) => {
  await requirePermission(event, PERMISSIONS.LINKS_READ)
  const parsed = listLinksQuerySchema.safeParse(getQuery(event))

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.flatten().formErrors.join(', ') || 'Invalid query',
    })
  }

  return await listLinks(event, parsed.data)
})

