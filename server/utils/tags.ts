import type { H3Event } from 'h3'
import { asc, count, desc, eq } from 'drizzle-orm'
import { links, tags } from '~/server/database/schema'
import { useDrizzle } from '~/server/utils/db'
import { generateId } from '~/server/utils/id'

export async function listTags(event: H3Event) {
  const db = await useDrizzle(event)

  return await db.query.tags.findMany({
    orderBy: [asc(tags.name)],
  })
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

  return tag || null
}

export async function listTagsWithCounts(event: H3Event) {
  const db = await useDrizzle(event)

  return await db
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
}
