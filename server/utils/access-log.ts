import type { H3Event } from 'h3'
import { getHeader, getRequestIP, getQuery } from 'h3'
import geoip from 'geoip-lite'
import { UAParser } from 'ua-parser-js'
import { access_logs, qr_scans } from '~/server/database/schema'
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

export async function useAccessLog(event: H3Event, link: StoredLink) {
  const db = await useDrizzle(event)
  const ua = getHeader(event, 'user-agent') || ''

  if (isBot(ua)) {
    return
  }

  const parser = new UAParser(ua)
  const result = parser.getResult()
  const ip = normalizeIp(getRequestIP(event, { xForwardedFor: true }) || null)
  const geo = ip ? geoip.lookup(ip) : null
  const deviceType = result.device.type || 'desktop'
  const [latitude, longitude] = geo?.ll || [null, null]

  const query = getQuery(event)

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

  // Track QR scans separately if parameter is present
  if (query.r === 'qr') {
    await db.insert(qr_scans).values({
      link_id: link.id,
      slug: link.slug,
    })
  }
}
