import type { H3Event } from 'h3'
import { createError, getRequestURL } from 'h3'
import { and, desc, eq, ilike, inArray, lt, or, sql } from 'drizzle-orm'
import { useRuntimeConfig } from '#imports'
import type { CreateLinkInput, UpdateLinkInput } from '~/shared/schemas/link'
import { access_logs, links } from '~/server/database/schema'
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

export function buildShortLink(event: H3Event, slug: string) {
  const requestUrl = getRequestURL(event)
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

  let result
  if (runtimeConfig.caseSensitive) {
    result = await db.query.links.findFirst({
      where: eq(links.slug, normalized),
    })
  } else {
    result = await db.query.links.findFirst({
      where: sql`lower(${links.slug}) = ${normalized}`,
    })
  }

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
    .where(runtimeConfig.caseSensitive ? eq(links.slug, normalizedSlug) : sql`lower(${links.slug}) = ${normalizedSlug}`)
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
    .where(runtimeConfig.caseSensitive ? eq(links.slug, normalized) : sql`lower(${links.slug}) = ${normalized}`)
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

  // Optimized: Single query with LEFT JOIN instead of separate queries
  const rows = await db
    .select({
      id: links.id,
      slug: links.slug,
      url: links.url,
      comment: links.comment,
      title: links.title,
      description: links.description,
      image: links.image,
      apple: links.apple,
      google: links.google,
      cloaking: links.cloaking,
      redirect_with_query: links.redirect_with_query,
      password: links.password,
      unsafe: links.unsafe,
      tag_id: links.tag_id,
      expiration: links.expiration,
      created_at: links.created_at,
      updated_at: links.updated_at,
      click_count: sql<number>`COALESCE(COUNT(${access_logs.id}), 0)::int`,
    })
    .from(links)
    .leftJoin(access_logs, eq(access_logs.link_id, links.id))
    .where(filters.length ? and(...filters) : undefined)
    .groupBy(links.id)
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
  const imported: StoredLink[] = []

  for (const item of items) {
    if (overwrite) {
      const upserted = await upsertLink(event, item)
      if (upserted) {
        imported.push(upserted)
      }
      continue
    }

    if (item.slug) {
      const existing = await getLink(event, item.slug)
      if (existing) {
        continue
      }
    }

    const created = await createLink(event, item)
    if (created) {
      imported.push(created)
    }
  }

  return imported
}
