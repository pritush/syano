import { createError, defineEventHandler, getQuery } from 'h3'
import { searchLinksQuerySchema } from '~/shared/schemas/link'
import { searchLinks } from '~/server/utils/link-store'
import { requirePermission } from '~/server/utils/auth'
import { PERMISSIONS } from '~/shared/permissions'

export default defineEventHandler(async (event) => {
  await requirePermission(event, PERMISSIONS.LINKS_READ)
  const parsed = searchLinksQuerySchema.safeParse(getQuery(event))

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.flatten().formErrors.join(', ') || 'Invalid query',
    })
  }

  return {
    items: await searchLinks(event, parsed.data.q, parsed.data.limit),
  }
})

