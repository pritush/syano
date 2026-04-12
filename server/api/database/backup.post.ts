import { z } from 'zod'
import { usePool } from '~/server/utils/db'

/**
 * Full Database Backup
 * Exports all tables (links, tags, access_logs, site_settings) as JSON
 */
export default defineEventHandler(async (event) => {
  const pool = await usePool(event)

  try {
    // Export all tables
    const [links, tags, accessLogs, siteSettings] = await Promise.all([
      pool.query('SELECT * FROM links ORDER BY created_at DESC'),
      pool.query('SELECT * FROM tags ORDER BY created_at DESC'),
      pool.query('SELECT * FROM access_logs ORDER BY created_at DESC LIMIT 10000'), // Limit logs to prevent huge files
      pool.query('SELECT * FROM site_settings'),
    ])

    const backup = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      database: 'syano',
      tables: {
        links: {
          count: links.rows.length,
          data: links.rows,
        },
        tags: {
          count: tags.rows.length,
          data: tags.rows,
        },
        access_logs: {
          count: accessLogs.rows.length,
          data: accessLogs.rows,
          note: 'Limited to 10,000 most recent entries',
        },
        site_settings: {
          count: siteSettings.rows.length,
          data: siteSettings.rows,
        },
      },
      metadata: {
        total_links: links.rows.length,
        total_tags: tags.rows.length,
        total_logs: accessLogs.rows.length,
        total_settings: siteSettings.rows.length,
      },
    }

    return backup
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to create database backup',
    })
  }
})
