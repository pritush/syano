import { createError, defineEventHandler, readBody } from 'h3'
import { deleteTagSchema } from '~/shared/schemas/tag'
import { deleteTag } from '~/server/utils/tags'

export default defineEventHandler(async (event) => {
  const parsed = deleteTagSchema.safeParse(await readBody(event))

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.flatten().formErrors.join(', ') || 'Invalid tag payload',
    })
  }

  const tag = await deleteTag(event, parsed.data.id)

  if (!tag) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Tag not found',
    })
  }

  return {
    ok: true,
    id: tag.id,
  }
})

