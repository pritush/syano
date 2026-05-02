import type { H3Event } from 'h3'
import { eq } from 'drizzle-orm'
import { createDefaultSiteSettings, SiteSettingsSchema, type SiteSettings } from '~/shared/schemas/settings'
import { site_settings } from '~/server/database/schema'
import { useDrizzle } from '~/server/utils/db'
import { useSettingsCache, invalidateSettingsCache } from '~/server/utils/cache'

export function normalizeSiteSettings(input: unknown): SiteSettings {
  const parsed = SiteSettingsSchema.safeParse(input)
  return parsed.success ? parsed.data : createDefaultSiteSettings()
}

export async function loadSiteSettingsForHomepage(event?: H3Event): Promise<SiteSettings> {
  const cache = useSettingsCache()
  const cacheKey = 'site-settings:default'

  // Try cache first
  const cached = cache.get(cacheKey)
  if (cached !== null) {
    return cached
  }

  // Cache miss - query database
  const db = await useDrizzle(event)
  const row = await db.query.site_settings.findFirst({
    where: eq(site_settings.id, 'default'),
  })

  const settings = row
    ? normalizeSiteSettings({
        homepage_mode: row.homepage_mode,
        redirect_url: row.redirect_url,
        redirect_timeout: row.redirect_timeout,
        bio_content: row.bio_content,
      })
    : createDefaultSiteSettings()

  // Cache for 5 minutes
  cache.set(cacheKey, settings, 300)

  return settings
}

export async function saveSiteSettings(event: H3Event, input: SiteSettings) {
  const db = await useDrizzle(event)
  const payload = normalizeSiteSettings(input)

  await db
    .insert(site_settings)
    .values({
      id: 'default',
      homepage_mode: payload.homepage_mode,
      redirect_url: payload.redirect_url,
      redirect_timeout: payload.redirect_timeout,
      bio_content: payload.bio_content,
    })
    .onConflictDoUpdate({
      target: site_settings.id,
      set: {
        homepage_mode: payload.homepage_mode,
        redirect_url: payload.redirect_url,
        redirect_timeout: payload.redirect_timeout,
        bio_content: payload.bio_content,
      },
    })

  // Invalidate cache
  invalidateSettingsCache()

  return payload
}
