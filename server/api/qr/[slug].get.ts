import { defineEventHandler, getRouterParam, getQuery, createError, setHeader } from 'h3'
import QRCode from 'qrcode'

export default defineCachedEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  const query = getQuery(event)
  const format = (query.format as string) || 'svg'
  const config = useRuntimeConfig()

  if (!slug) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Slug is required',
    })
  }

  // Priority: 1. Env variable (NUXT_PUBLIC_SITE_URL), 2. Auto-detect from headers, 3. Localhost fallback
  let baseUrl = ''
  
  // 1. Check for configured site URL (highest priority)
  if (config.public.siteUrl) {
    baseUrl = config.public.siteUrl
  } 
  // 2. Auto-detect from request headers
  else {
    const host = event.node.req?.headers?.host
    const forwardedProto = event.node.req?.headers['x-forwarded-proto']
    const forwardedHost = event.node.req?.headers['x-forwarded-host']
    
    // Use forwarded headers (for proxies/load balancers) or direct headers
    const detectedHost = forwardedHost || host
    const detectedProto = forwardedProto || (detectedHost?.includes('localhost') ? 'http' : 'https')
    
    if (detectedHost) {
      baseUrl = `${detectedProto}://${detectedHost}`
    } 
    // 3. Final fallback to localhost
    else {
      baseUrl = 'http://localhost:7466'
    }
  }
  
  // Ensure no trailing slash
  baseUrl = baseUrl.replace(/\/$/, '')
  
  // Generate QR code URL with ?r=qr parameter for tracking
  const qrUrl = `${baseUrl}/${slug}?r=qr`

  try {
    if (format === 'svg') {
      // Generate SVG QR code
      const svgString = await QRCode.toString(qrUrl, {
        type: 'svg',
        width: 512,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
        errorCorrectionLevel: 'M',
      })

      setHeader(event, 'Content-Type', 'image/svg+xml')
      setHeader(event, 'Cache-Control', 'public, max-age=86400') // Cache for 24 hours
      return svgString
    } else if (format === 'png') {
      // Generate PNG QR code as data URL
      const pngDataUrl = await QRCode.toDataURL(qrUrl, {
        width: 512,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
        errorCorrectionLevel: 'M',
      })

      // Return the data URL (can be used directly in img src)
      return { dataUrl: pngDataUrl }
    } else {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid format. Use svg or png',
      })
    }
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to generate QR code',
    })
  }
}, {
  maxAge: 60 * 60 * 24 * 7, // Highly aggressive 1-week caching
  name: 'syano_qr_gen',
  getKey: (event) => {
    const slug = getRouterParam(event, 'slug') || 'error'
    const format = getQuery(event).format || 'svg'
    return `${slug}_${format}`
  }
})
