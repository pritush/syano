import { createError, defineEventHandler, readBody } from 'h3'
import { useRuntimeConfig } from '#imports'
import { createImportLinksSchema } from '~/shared/schemas/import-export'
import { importLinks } from '~/server/utils/link-store'

export default defineEventHandler(async (event) => {
  const runtimeConfig = useRuntimeConfig(event)
  const parsed = createImportLinksSchema(runtimeConfig.public.slugDefaultLength).safeParse(await readBody(event))

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.flatten().formErrors.join(', ') || 'Invalid import payload',
    })
  }

  const imported = await importLinks(event, parsed.data.items, parsed.data.overwrite)

  return {
    ok: true,
    count: imported.length,
    items: imported,
  }
})

