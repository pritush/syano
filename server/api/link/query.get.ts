import { createError, defineEventHandler, getQuery } from 'h3'
import { queryLinkSchema } from '~/shared/schemas/link'
import { getLink } from '~/server/utils/link-store'

export default defineEventHandler(async (event) => {
  const parsed = queryLinkSchema.safeParse(getQuery(event))

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.flatten().formErrors.join(', ') || 'Invalid query',
    })
  }

  const link = await getLink(event, parsed.data.slug)

  if (!link) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Link not found',
    })
  }

  return link
})

