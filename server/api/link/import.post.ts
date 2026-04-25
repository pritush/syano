import { createError, defineEventHandler, readBody } from 'h3'
import { useRuntimeConfig } from '#imports'
import { createImportLinksSchema } from '~/shared/schemas/import-export'
import { importLinks } from '~/server/utils/link-store'
import { requirePermission } from '~/server/utils/auth'
import { PERMISSIONS } from '~/shared/permissions'

export default defineEventHandler(async (event) => {
  await requirePermission(event, PERMISSIONS.LINKS_CREATE)
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

