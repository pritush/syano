import { z } from 'zod'
import { usePool, useDrizzle } from '~/server/utils/db'
import { links, tags, access_logs, site_settings } from '~/server/database/schema'

const RestoreOptionsSchema = z.object({
  backup: z.object({
    version: z.string(),
    exported_at: z.string(),
    tables: z.object({
      links: z.object({
        data: z.array(z.any()),
      }).optional(),
      tags: z.object({
        data: z.array(z.any()),
      }).optional(),
      access_logs: z.object({
        data: z.array(z.any()),
      }).optional(),
      site_settings: z.object({
        data: z.array(z.any()),
      }).optional(),
    }),
  }),
  options: z.object({
    clearExisting: z.boolean().default(false),
    restoreTables: z.object({
      links: z.boolean().default(true),
      tags: z.boolean().default(true),
      access_logs: z.boolean().default(false),
      site_settings: z.boolean().default(true),
    }).default({}),
  }).default({}),
})

/**
 * Full Database Restore
 * Restores database from backup JSON
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const validated = RestoreOptionsSchema.parse(body)
  
  const pool = await usePool(event)
  const db = await useDrizzle(event)

  const { backup, options } = validated
  const { clearExisting, restoreTables } = options

  const results = {
    restored: {
      links: 0,
      tags: 0,
      access_logs: 0,
      site_settings: 0,
    },
    errors: [] as string[],
  }

  try {
    // Start transaction
    await pool.query('BEGIN')

    // Clear existing data if requested
    if (clearExisting) {
      if (restoreTables.access_logs) {
        await pool.query('TRUNCATE TABLE access_logs CASCADE')
      }
      if (restoreTables.links) {
        await pool.query('TRUNCATE TABLE links CASCADE')
      }
      if (restoreTables.tags) {
        await pool.query('TRUNCATE TABLE tags CASCADE')
      }
      // Note: We don't truncate site_settings, we update it
    }

    // Restore tags first (links depend on tags)
    if (restoreTables.tags && backup.tables.tags?.data) {
      for (const tag of backup.tables.tags.data) {
        try {
          await db.insert(tags)
            .values({
              id: tag.id,
              name: tag.name,
              created_at: tag.created_at ? new Date(tag.created_at) : new Date(),
            })
            .onConflictDoUpdate({
              target: tags.id,
              set: {
                name: tag.name,
              },
            })
          results.restored.tags++
        } catch (error: any) {
          results.errors.push(`Tag ${tag.id}: ${error.message}`)
        }
      }
    }

    // Restore links
    if (restoreTables.links && backup.tables.links?.data) {
      for (const link of backup.tables.links.data) {
        try {
          await db.insert(links)
            .values({
              id: link.id,
              slug: link.slug,
              url: link.url,
              comment: link.comment,
              title: link.title,
              description: link.description,
              image: link.image,
              apple: link.apple,
              google: link.google,
              cloaking: link.cloaking || false,
              redirect_with_query: link.redirect_with_query || false,
              password: link.password,
              unsafe: link.unsafe || false,
              tag_id: link.tag_id,
              expiration: link.expiration,
              created_at: link.created_at ? new Date(link.created_at) : new Date(),
              updated_at: link.updated_at ? new Date(link.updated_at) : new Date(),
            })
            .onConflictDoUpdate({
              target: links.slug,
              set: {
                url: link.url,
                comment: link.comment,
                title: link.title,
                description: link.description,
                image: link.image,
                apple: link.apple,
                google: link.google,
                cloaking: link.cloaking || false,
                redirect_with_query: link.redirect_with_query || false,
                password: link.password,
                unsafe: link.unsafe || false,
                tag_id: link.tag_id,
                expiration: link.expiration,
                updated_at: new Date(),
              },
            })
          results.restored.links++
        } catch (error: any) {
          results.errors.push(`Link ${link.slug}: ${error.message}`)
        }
      }
    }

    // Restore access logs
    if (restoreTables.access_logs && backup.tables.access_logs?.data) {
      for (const log of backup.tables.access_logs.data) {
        try {
          await pool.query(
            `INSERT INTO access_logs (
              id, link_id, slug, url, ua, ip, referer, country, region, city,
              timezone, language, os, browser, browser_type, device, device_type,
              latitude, longitude, created_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
              $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
            ) ON CONFLICT (id) DO NOTHING`,
            [
              log.id, log.link_id, log.slug, log.url, log.ua, log.ip, log.referer,
              log.country, log.region, log.city, log.timezone, log.language, log.os,
              log.browser, log.browser_type, log.device, log.device_type,
              log.latitude || 0, log.longitude || 0,
              log.created_at ? new Date(log.created_at) : new Date(),
            ]
          )
          results.restored.access_logs++
        } catch (error: any) {
          // Skip duplicate logs silently
          if (!error.message.includes('duplicate')) {
            results.errors.push(`Log ${log.id}: ${error.message}`)
          }
        }
      }
    }

    // Restore site settings
    if (restoreTables.site_settings && backup.tables.site_settings?.data) {
      for (const setting of backup.tables.site_settings.data) {
        try {
          await db.insert(site_settings)
            .values({
              id: setting.id,
              homepage_mode: setting.homepage_mode,
              redirect_url: setting.redirect_url,
              bio_content: setting.bio_content,
            })
            .onConflictDoUpdate({
              target: site_settings.id,
              set: {
                homepage_mode: setting.homepage_mode,
                redirect_url: setting.redirect_url,
                bio_content: setting.bio_content,
              },
            })
          results.restored.site_settings++
        } catch (error: any) {
          results.errors.push(`Settings ${setting.id}: ${error.message}`)
        }
      }
    }

    // Commit transaction
    await pool.query('COMMIT')

    return {
      success: true,
      message: 'Database restored successfully',
      results,
    }
  } catch (error: any) {
    // Rollback on error
    await pool.query('ROLLBACK')
    
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to restore database',
    })
  }
})
