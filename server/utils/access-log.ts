import type { H3Event } from 'h3'
import { getHeader, getRequestIP, getQuery } from 'h3'
import geoip from 'geoip-lite'
import { UAParser } from 'ua-parser-js'
import { sql, eq } from 'drizzle-orm'
import { access_logs, links, qr_scans } from '~/server/database/schema'
import type { StoredLink } from '~/server/utils/link-store'
import { useDrizzle } from '~/server/utils/db'

function isBot(ua: string) {
  return /bot|crawler|spider|preview|slack|discord/i.test(ua)
}

function normalizeIp(ip: string | null | undefined) {
  if (!ip) {
    return null
  }

  const value = ip.split(',')[0]?.trim() || ''

  if (!value || value === '::1') {
    return null
  }

  if (value.startsWith('::ffff:')) {
    return value.slice('::ffff:'.length)
  }

  return value
}

function pickPrimaryLanguage(headerValue: string) {
  return headerValue
    .split(',')
    .map((entry) => entry.split(';')[0]?.trim())
    .find(Boolean) || null
}

function formatBrowser(browser: ReturnType<UAParser['getBrowser']>) {
  if (!browser.name) {
    return 'Unknown'
  }

  return browser.major ? `${browser.name} ${browser.major}` : browser.name
}

function formatOs(os: ReturnType<UAParser['getOS']>) {
  if (!os.name) {
    return 'Unknown'
  }

  return os.version ? `${os.name} ${os.version}` : os.name
}

function formatDevice(device: ReturnType<UAParser['getDevice']>, deviceType: string) {
  const parts = [device.vendor, device.model].filter(Boolean)

  if (parts.length) {
    return parts.join(' ')
  }

  return deviceType
}

export function useAccessLog(event: H3Event, link: StoredLink) {
  const ua = getHeader(event, 'user-agent') || ''

  if (isBot(ua)) {
    return
  }

  const parser = new UAParser(ua)
  const result = parser.getResult()
  const ip = normalizeIp(getRequestIP(event, { xForwardedFor: true }) || null)
  const geo = ip ? geoip.lookup(ip) : null
  const deviceType = result.device.type || 'desktop'

  const query = getQuery(event)

  // Fire-and-forget: don't block the redirect response
  _writeAccessLog(event, link, ua, result, geo, deviceType, query)
    .catch(err => console.error('[AccessLog] Failed to write access log:', err))
}

async function _writeAccessLog(
  event: H3Event,
  link: StoredLink,
  ua: string,
  result: ReturnType<UAParser['getResult']>,
  geo: ReturnType<typeof geoip.lookup>,
  deviceType: string,
  query: ReturnType<typeof getQuery>,
) {
  const db = await useDrizzle(event)

  // Record standard access log
  await db.insert(access_logs).values({
    link_id: link.id,
    slug: link.slug,
    url: link.url,
    ua,
    ip: null, // REDACTED FOR PRIVACY
    referer: getHeader(event, 'referer') || null,
    country: geo?.country || null,
    region: geo?.region || null,
    city: geo?.city || null,
    timezone: geo?.timezone || null,
    language: pickPrimaryLanguage(getHeader(event, 'accept-language') || ''),
    os: formatOs(result.os),
    browser: formatBrowser(result.browser),
    browser_type: result.browser.name || result.engine.name || 'Unknown',
    device: formatDevice(result.device, deviceType),
    device_type: deviceType,
    latitude: null, // REDACTED FOR PRIVACY
    longitude: null, // REDACTED FOR PRIVACY
    utm_source: typeof query.utm_source === 'string' ? query.utm_source : null,
    utm_medium: typeof query.utm_medium === 'string' ? query.utm_medium : null,
    utm_campaign: typeof query.utm_campaign === 'string' ? query.utm_campaign : null,
    utm_term: typeof query.utm_term === 'string' ? query.utm_term : null,
    utm_content: typeof query.utm_content === 'string' ? query.utm_content : null,
  })

  // Atomically increment the denormalized click_count on the links table
  await db.update(links)
    .set({ click_count: sql`${links.click_count} + 1` })
    .where(eq(links.id, link.id))

  // Track QR scans separately if parameter is present
  const rParam = String(query.r || '').toLowerCase()
  if (rParam === 'qr') {
    try {
      await db.insert(qr_scans).values({
        link_id: link.id,
        slug: link.slug,
      })
    } catch (error) {
      console.error('[QR Tracking] Failed to record QR scan:', error)
    }
  }
}
