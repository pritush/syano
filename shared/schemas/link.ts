import { z } from 'zod'

export const SLUG_REGEX = /^[A-Za-z0-9_-]+$/

const nullableString = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .nullish()
    .transform((value) => value || null)

const nullableUrl = () =>
  z
    .string()
    .url()
    .nullish()
    .transform((value) => value || null)

const expirationSchema = z
  .union([z.string().datetime({ offset: true }), z.date(), z.number().int().positive()])
  .nullish()
  .transform((value) => {
    if (!value) {
      return null
    }

    if (typeof value === 'number') {
      return value
    }

    const date = value instanceof Date ? value : new Date(value)
    return date.getTime()
  })

export function createLinkSchema(defaultSlugLength: number) {
  return z.object({
    slug: z
      .string()
      .trim()
      .min(1)
      .max(128)
      .regex(SLUG_REGEX)
      .optional(),
    url: z.string().url(),
    comment: nullableString(240),
    title: nullableString(160),
    description: nullableString(300),
    image: nullableUrl(),
    apple: nullableUrl(),
    google: nullableUrl(),
    cloaking: z.boolean().default(false),
    redirect_with_query: z.boolean().default(false),
    password: nullableString(120),
    unsafe: z.boolean().default(false),
    expiration: expirationSchema,
    tag_id: z.string().trim().min(1).max(64).nullish().transform((value) => value || null),
    slug_length: z.number().int().min(3).max(32).default(defaultSlugLength),
  })
}

export const updateLinkSchema = z.object({
  slug: z.string().trim().min(1).max(128).regex(SLUG_REGEX),
  url: z.string().url().optional(),
  comment: nullableString(240).optional(),
  title: nullableString(160).optional(),
  description: nullableString(300).optional(),
  image: nullableUrl().optional(),
  apple: nullableUrl().optional(),
  google: nullableUrl().optional(),
  cloaking: z.boolean().optional(),
  redirect_with_query: z.boolean().optional(),
  password: nullableString(120).optional(),
  unsafe: z.boolean().optional(),
  expiration: expirationSchema.optional(),
  tag_id: z.string().trim().min(1).max(64).nullable().optional(),
})

export const deleteLinkSchema = z.object({
  slug: z.string().trim().min(1).max(128).regex(SLUG_REGEX),
})

export const listLinksQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().trim().min(1).max(64).optional(),
  tag_id: z.string().trim().min(1).max(64).optional(),
})

export const searchLinksQuerySchema = z.object({
  q: z.string().trim().default(''),
  limit: z.coerce.number().int().min(1).max(50).default(10),
})

export const queryLinkSchema = z.object({
  slug: z.string().trim().min(1).max(128).regex(SLUG_REGEX),
})

export type CreateLinkInput = z.infer<ReturnType<typeof createLinkSchema>>
export type UpdateLinkInput = z.infer<typeof updateLinkSchema>
