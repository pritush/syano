import type { H3Event } from 'h3'
import { links, tags, site_settings, access_logs } from '~/server/database/schema'
import { useDrizzle } from '~/server/utils/db'

export interface DatabaseBackup {
  version: string
  exported_at: string
  data: {
    tags: Array<typeof tags.$inferSelect>
    links: Array<typeof links.$inferSelect>
    site_settings: Array<typeof site_settings.$inferSelect>
    access_logs: Array<typeof access_logs.$inferSelect>
  }
}

export async function getCompleteBackup(event: H3Event): Promise<DatabaseBackup> {
  const db = await useDrizzle(event)

  const [t, l, s, a] = await Promise.all([
    db.select().from(tags).execute(),
    db.select().from(links).execute(),
    db.select().from(site_settings).execute(),
    db.select().from(access_logs).execute(),
  ])

  return {
    version: '1.0',
    exported_at: new Date().toISOString(),
    data: {
      tags: t,
      links: l,
      site_settings: s,
      access_logs: a,
    },
  }
}

export async function restoreCompleteBackup(event: H3Event, backup: DatabaseBackup) {
  const db = await useDrizzle(event)

  await db.transaction(async (tx) => {
    // 1. Clear existing data (in order of dependencies)
    // Access logs reference links
    // Links reference tags
    await tx.delete(access_logs).execute()
    await tx.delete(links).execute()
    await tx.delete(tags).execute()
    await tx.delete(site_settings).execute()

    // 2. Insert new data
    if (backup.data.tags.length > 0) {
      await tx.insert(tags).values(backup.data.tags).execute()
    }
    
    if (backup.data.links.length > 0) {
      await tx.insert(links).values(backup.data.links).execute()
    }

    if (backup.data.site_settings.length > 0) {
      await tx.insert(site_settings).values(backup.data.site_settings).execute()
    }

    if (backup.data.access_logs.length > 0) {
      // Access logs might be large, we might want to chunk this
      const CHUNK_SIZE = 1000
      for (let i = 0; i < backup.data.access_logs.length; i += CHUNK_SIZE) {
        const chunk = backup.data.access_logs.slice(i, i + CHUNK_SIZE)
        await tx.insert(access_logs).values(chunk).execute()
      }
    }
  })

  return {
    message: 'Database restored successfully',
    stats: {
      tags: backup.data.tags.length,
      links: backup.data.links.length,
      site_settings: backup.data.site_settings.length,
      access_logs: backup.data.access_logs.length,
    },
  }
}
