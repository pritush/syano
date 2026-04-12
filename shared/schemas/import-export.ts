import { z } from 'zod'
import { createLinkSchema } from '~/shared/schemas/link'

export function createImportLinksSchema(defaultSlugLength: number) {
  return z.object({
    overwrite: z.boolean().default(true),
    items: z.array(createLinkSchema(defaultSlugLength)).min(1).max(500),
  })
}

