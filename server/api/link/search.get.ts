import { createError, defineEventHandler, getQuery } from 'h3'
import { searchLinksQuerySchema } from '~/shared/schemas/link'
import { searchLinks } from '~/server/utils/link-store'

export default defineEventHandler(async (event) => {
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

