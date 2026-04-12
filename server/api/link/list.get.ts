import { createError, defineEventHandler, getQuery } from 'h3'
import { listLinksQuerySchema } from '~/shared/schemas/link'
import { listLinks } from '~/server/utils/link-store'

export default defineEventHandler(async (event) => {
  const parsed = listLinksQuerySchema.safeParse(getQuery(event))

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.flatten().formErrors.join(', ') || 'Invalid query',
    })
  }

  return await listLinks(event, parsed.data)
})

