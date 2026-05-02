import type { H3Event } from 'h3'
import { asc, count, desc, eq } from 'drizzle-orm'
import { links, tags } from '~/server/database/schema'
import { useDrizzle } from '~/server/utils/db'
import { generateId } from '~/server/utils/id'
import { useTagsCache, invalidateTagsCache } from '~/server/utils/cache'

export async function listTags(event: H3Event) {
  const cache = useTagsCache()
  const cacheKey = 'tags:list'

  // Try cache first
  const cached = cache.get(cacheKey)
  if (cached !== null) {
    return cached
  }

  // Cache miss - query database
  const db = await useDrizzle(event)
  const result = await db.query.tags.findMany({
    orderBy: [asc(tags.name)],
  })

  // Cache for 3 minutes
  cache.set(cacheKey, result, 180)

  return result
}

export async function createTag(event: H3Event, name: string) {
  const db = await useDrizzle(event)

  const [tag] = await db
    .insert(tags)
    .values({
      id: generateId(),
      name,
    })
    .returning()

  // Invalidate cache
  invalidateTagsCache()

  return tag
}

export async function deleteTag(event: H3Event, id: string) {
  const db = await useDrizzle(event)

  await db
    .update(links)
    .set({
      tag_id: null,
      updated_at: new Date(),
    })
    .where(eq(links.tag_id, id))

  const [tag] = await db
    .delete(tags)
    .where(eq(tags.id, id))
    .returning()

  // Invalidate cache
  invalidateTagsCache()

  return tag || null
}

export async function listTagsWithCounts(event: H3Event) {
  const cache = useTagsCache()
  const cacheKey = 'tags:with-counts'

  // Try cache first
  const cached = cache.get(cacheKey)
  if (cached !== null) {
    return cached
  }

  // Cache miss - query database
  const db = await useDrizzle(event)
  const result = await db
    .select({
      id: tags.id,
      name: tags.name,
      created_at: tags.created_at,
      link_count: count(links.id),
    })
    .from(tags)
    .leftJoin(links, eq(links.tag_id, tags.id))
    .groupBy(tags.id, tags.name, tags.created_at)
    .orderBy(desc(tags.created_at))

  // Cache for 3 minutes
  cache.set(cacheKey, result, 180)

  return result
}
