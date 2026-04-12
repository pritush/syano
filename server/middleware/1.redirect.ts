import { defineEventHandler, createError, getHeader, getQuery, getRequestURL, readBody, sendRedirect, setHeader, setResponseStatus } from 'h3'
import { useAppConfig, useRuntimeConfig } from '#imports'
import { useAccessLog } from '~/server/utils/access-log'
import { getLink } from '~/server/utils/link-store'
import { renderCloakPage, renderOpenGraphPage, renderPasswordPage, renderUnsafePage } from '~/server/utils/template'

function isReservedSlug(slug: string, reserveSlug: string[]) {
  return reserveSlug.map((item) => item.toLowerCase()).includes(slug.toLowerCase())
}

function isSocialBot(ua: string) {
  return /facebookexternalhit|twitterbot|slackbot|discordbot|linkedinbot/i.test(ua)
}

function resolveDestination(link: {
  url: string
  apple: string | null
  google: string | null
}, ua: string) {
  if (/iphone|ipad|ipod/i.test(ua) && link.apple) {
    return link.apple
  }

  if (/android/i.test(ua) && link.google) {
    return link.google
  }

  return link.url
}

function appendRequestQuery(destination: string, requestUrl: URL) {
  if (!requestUrl.searchParams.size) {
    return destination
  }

  const target = new URL(destination)
  requestUrl.searchParams.forEach((value, key) => {
    target.searchParams.append(key, value)
  })
  return target.toString()
}

export default defineEventHandler(async (event) => {
  const requestUrl = getRequestURL(event)
  const runtimeConfig = useRuntimeConfig(event)

  if (requestUrl.pathname === '/') {
    return
  }

  const segments = requestUrl.pathname.split('/').filter(Boolean)
  if (segments.length !== 1) {
    return
  }

  const slug = decodeURIComponent(segments[0] || '')
  const appConfig = useAppConfig()
  const slugRegexSource = typeof appConfig.slugRegex === 'string' ? appConfig.slugRegex : '^[A-Za-z0-9_-]+$'
  const reserveSlug = Array.isArray(appConfig.reserveSlug) ? appConfig.reserveSlug : []
  const slugRegex = new RegExp(slugRegexSource)

  if (!slugRegex.test(slug) || isReservedSlug(slug, reserveSlug)) {
    return
  }

  const link = await getLink(event, slug)

  if (!link || (link.expiration && Number(link.expiration) < Date.now())) {
    if (runtimeConfig.notFoundRedirect) {
      return sendRedirect(event, runtimeConfig.notFoundRedirect, runtimeConfig.redirectStatusCode)
    }

    throw createError({
      statusCode: 404,
      statusMessage: 'Link not found',
    })
  }

  event.context.link = link

  const method = event.method || 'GET'
  const body =
    method === 'POST'
      ? ((await readBody(event).catch(() => ({}))) as Record<string, string | undefined>)
      : ({} as Record<string, string | undefined>)
  const query = getQuery(event)
  const password = body.password || String(query.password || '') || getHeader(event, 'x-link-password') || ''
  const confirm = String(body.confirm || query.confirm || '').toLowerCase() === 'true'

  if (link.password && password !== link.password) {
    setResponseStatus(event, password ? 401 : 200)
    setHeader(event, 'content-type', 'text/html; charset=utf-8')
    return renderPasswordPage(requestUrl.pathname, Boolean(password))
  }

  if (link.unsafe && !confirm) {
    setHeader(event, 'content-type', 'text/html; charset=utf-8')
    return renderUnsafePage(`${requestUrl.pathname}?confirm=true`)
  }

  const ua = getHeader(event, 'user-agent') || ''
  let destination = resolveDestination(link, ua)

  if (runtimeConfig.redirectWithQuery || link.redirect_with_query) {
    destination = appendRequestQuery(destination, requestUrl)
  }

  await useAccessLog(event, link)

  if (isSocialBot(ua)) {
    setHeader(event, 'content-type', 'text/html; charset=utf-8')
    return renderOpenGraphPage(destination, link.title, link.description, link.image)
  }

  if (link.cloaking) {
    setHeader(event, 'content-type', 'text/html; charset=utf-8')
    return renderCloakPage(destination)
  }

  return sendRedirect(event, destination, runtimeConfig.redirectStatusCode)
})
