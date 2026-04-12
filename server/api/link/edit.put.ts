import { createError, defineEventHandler, readBody } from 'h3'
import { updateLinkSchema } from '~/shared/schemas/link'
import { updateLink } from '~/server/utils/link-store'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = updateLinkSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.flatten().formErrors.join(', ') || 'Invalid link payload',
    })
  }

  const link = await updateLink(event, parsed.data)

  if (!link) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Link not found',
    })
  }

  return link
})

