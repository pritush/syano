import type { H3Event } from 'h3'
import { createError, getRequestURL } from 'h3'
import { and, desc, eq, ilike, lt, or, sql } from 'drizzle-orm'
import { useRuntimeConfig } from '#imports'
import type { CreateLinkInput, UpdateLinkInput } from '~/shared/schemas/link'
import { links } from '~/server/database/schema'
import { useDrizzle } from '~/server/utils/db'
import { generateId } from '~/server/utils/id'
import { useLinkCache, invalidateLinkCache } from '~/server/utils/cache'

export type StoredLink = typeof links.$inferSelect

const SLUG_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

function randomSlug(length: number) {
  return Array.from({ length }, () => SLUG_ALPHABET[Math.floor(Math.random() * SLUG_ALPHABET.length)]).join('')
}

export function normalizeSlug(slug: string, caseSensitive = false) {
  const trimmed = slug.trim()
  return caseSensitive ? trimmed : trimmed.toLowerCase()
}

export function buildShortLink(event: H3Event, slug: string, senderIdName?: string | null) {
  const requestUrl = getRequestURL(event)
  if (senderIdName) {
    return `${requestUrl.origin}/${senderIdName}/${slug}`
  }
  return `${requestUrl.origin}/${slug}`
}

export async function getLink(event: H3Event, slug: string) {
  const runtimeConfig = useRuntimeConfig(event)
  const normalized = normalizeSlug(slug, runtimeConfig.caseSensitive)
  const cache = useLinkCache()
  const cacheKey = `link:${normalized}`

  // Try cache first
  const cached = cache.get(cacheKey)
  if (cached !== null) {
    return cached
  }

  // Cache miss - query database
  const db = await useDrizzle(event)

  const result = await db.query.links.findFirst({
    where: eq(links.slug, normalized),
  })

  // Cache the result (even if null to prevent repeated lookups)
  cache.set(cacheKey, result || null, 60) // 60 second TTL

  return result
}

export async function ensureAvailableSlug(event: H3Event, requestedSlug?: string, slugLength?: number) {
  const runtimeConfig = useRuntimeConfig(event)
  const targetLength = slugLength || runtimeConfig.public.slugDefaultLength || 6

  if (requestedSlug) {
    return normalizeSlug(requestedSlug, runtimeConfig.caseSensitive)
  }

  let candidate = randomSlug(targetLength)
  let existing = await getLink(event, candidate)

  while (existing) {
    candidate = randomSlug(targetLength)
    existing = await getLink(event, candidate)
  }

  return candidate
}

export async function createLink(event: H3Event, input: CreateLinkInput): Promise<StoredLink> {
  const db = await useDrizzle(event)
  const slug = await ensureAvailableSlug(event, input.slug, input.slug_length)

  const [link] = await db
    .insert(links)
    .values({
      id: generateId(),
      slug,
      url: input.url,
      comment: input.comment,
      title: input.title,
      description: input.description,
      image: input.image,
      apple: input.apple,
      google: input.google,
      cloaking: input.cloaking,
      redirect_with_query: input.redirect_with_query,
      password: input.password,
      unsafe: input.unsafe,
      expiration: input.expiration,
      tag_id: input.tag_id,
      sender_id: input.sender_id,
      updated_at: new Date(),
    })
    .returning()

  if (!link) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create link',
    })
  }

  // Cache the new link
  const runtimeConfig = useRuntimeConfig(event)
  const cache = useLinkCache()
  const normalized = normalizeSlug(slug, runtimeConfig.caseSensitive)
  cache.set(`link:${normalized}`, link, 60)

  return link
}

export async function updateLink(event: H3Event, input: UpdateLinkInput) {
  const db = await useDrizzle(event)
  const runtimeConfig = useRuntimeConfig(event)
  const normalizedSlug = normalizeSlug(input.slug, runtimeConfig.caseSensitive)

  const [link] = await db
    .update(links)
    .set({
      ...input,
      slug: normalizedSlug,
      updated_at: new Date(),
    })
    .where(eq(links.slug, normalizedSlug))
    .returning()

  // Invalidate cache for this link
  if (link) {
    invalidateLinkCache(normalizedSlug, runtimeConfig.caseSensitive)
  }

  return link || null
}

export async function upsertLink(event: H3Event, input: CreateLinkInput): Promise<StoredLink> {
  const db = await useDrizzle(event)
  const slug = await ensureAvailableSlug(event, input.slug, input.slug_length)

  const [link] = await db
    .insert(links)
    .values({
      id: generateId(),
      slug,
      url: input.url,
      comment: input.comment,
      title: input.title,
      description: input.description,
      image: input.image,
      apple: input.apple,
      google: input.google,
      cloaking: input.cloaking,
      redirect_with_query: input.redirect_with_query,
      password: input.password,
      unsafe: input.unsafe,
      expiration: input.expiration,
      tag_id: input.tag_id,
      sender_id: input.sender_id,
      updated_at: new Date(),
    })
    .onConflictDoUpdate({
      target: links.slug,
      set: {
        url: input.url,
        comment: input.comment,
        title: input.title,
        description: input.description,
        image: input.image,
        apple: input.apple,
        google: input.google,
        cloaking: input.cloaking,
        redirect_with_query: input.redirect_with_query,
        password: input.password,
        unsafe: input.unsafe,
        expiration: input.expiration,
        tag_id: input.tag_id,
        sender_id: input.sender_id,
        updated_at: new Date(),
      },
    })
    .returning()

  if (!link) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to upsert link',
    })
  }

  // Invalidate and update cache
  const runtimeConfig = useRuntimeConfig(event)
  invalidateLinkCache(slug, runtimeConfig.caseSensitive)

  return link
}

export async function deleteLink(event: H3Event, slug: string) {
  const db = await useDrizzle(event)
  const runtimeConfig = useRuntimeConfig(event)
  const normalized = normalizeSlug(slug, runtimeConfig.caseSensitive)

  const [deleted] = await db
    .delete(links)
    .where(eq(links.slug, normalized))
    .returning()

  // Invalidate cache
  if (deleted) {
    invalidateLinkCache(normalized, runtimeConfig.caseSensitive)
  }

  return deleted || null
}

export async function listLinks(
  event: H3Event,
  options: {
    limit: number
    cursor?: string
    tag_id?: string
  },
) {
  const db = await useDrizzle(event)
  const filters = []

  if (options.cursor) {
    filters.push(lt(links.id, options.cursor))
  }

  if (options.tag_id) {
    filters.push(eq(links.tag_id, options.tag_id))
  }

  // Use the denormalized click_count column instead of an expensive LEFT JOIN
  const rows = await db
    .select()
    .from(links)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(links.id))
    .limit(options.limit + 1)

  const nextCursor = rows.length > options.limit ? rows[options.limit - 1]?.id : null
  const items = rows.slice(0, options.limit)

  return {
    items,
    nextCursor,
  }
}

export async function searchLinks(event: H3Event, query: string, limit: number) {
  const db = await useDrizzle(event)
  const q = `%${query}%`

  return await db.query.links.findMany({
    where: query
      ? or(
          ilike(links.slug, q),
          ilike(links.url, q),
          ilike(links.comment, q),
        )
      : undefined,
    orderBy: [desc(links.id)],
    limit,
    columns: {
      slug: true,
      url: true,
      comment: true,
    },
  })
}

export async function exportLinks(event: H3Event) {
  const db = await useDrizzle(event)

  return await db.query.links.findMany({
    orderBy: [desc(links.id)],
  })
}

export async function importLinks(
  event: H3Event,
  items: CreateLinkInput[],
  overwrite = true,
) {
  if (items.length === 0) return []

  const db = await useDrizzle(event)
  const runtimeConfig = useRuntimeConfig(event)

  // Prepare all values: resolve slugs for items that need auto-generation
  const values = []
  for (const item of items) {
    const slug = await ensureAvailableSlug(event, item.slug, item.slug_length)
    values.push({
      id: generateId(),
      slug,
      url: item.url,
      comment: item.comment,
      title: item.title,
      description: item.description,
      image: item.image,
      apple: item.apple,
      google: item.google,
      cloaking: item.cloaking,
      redirect_with_query: item.redirect_with_query,
      password: item.password,
      unsafe: item.unsafe,
      expiration: item.expiration,
      tag_id: item.tag_id,
      sender_id: item.sender_id,
      updated_at: new Date(),
    })
  }

  let imported: StoredLink[]

  if (overwrite) {
    // Batch upsert: single INSERT ... ON CONFLICT DO UPDATE
    imported = await db
      .insert(links)
      .values(values)
      .onConflictDoUpdate({
        target: links.slug,
        set: {
          url: sql`EXCLUDED.url`,
          comment: sql`EXCLUDED.comment`,
          title: sql`EXCLUDED.title`,
          description: sql`EXCLUDED.description`,
          image: sql`EXCLUDED.image`,
          apple: sql`EXCLUDED.apple`,
          google: sql`EXCLUDED.google`,
          cloaking: sql`EXCLUDED.cloaking`,
          redirect_with_query: sql`EXCLUDED.redirect_with_query`,
          password: sql`EXCLUDED.password`,
          unsafe: sql`EXCLUDED.unsafe`,
          expiration: sql`EXCLUDED.expiration`,
          tag_id: sql`EXCLUDED.tag_id`,
          sender_id: sql`EXCLUDED.sender_id`,
          updated_at: new Date(),
        },
      })
      .returning()
  } else {
    // Non-overwrite: batch insert, skip conflicts silently
    imported = await db
      .insert(links)
      .values(values)
      .onConflictDoNothing({ target: links.slug })
      .returning()
  }

  // Invalidate cache for all affected slugs
  for (const link of imported) {
    invalidateLinkCache(link.slug, runtimeConfig.caseSensitive)
  }

  return imported
}
