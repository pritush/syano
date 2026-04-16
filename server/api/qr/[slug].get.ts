import { defineEventHandler, getRouterParam, getQuery, createError, setHeader } from 'h3'
import QRCode from 'qrcode'

export default defineCachedEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  const query = getQuery(event)
  const format = (query.format as string) || 'svg'

  if (!slug) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Slug is required',
    })
  }

  // Get the origin from the request
  const origin = event.node.req?.headers?.origin || event.node.req?.headers?.host || 'http://localhost:7466'
  const protocol = origin.includes('localhost') ? 'http://' : 'https://'
  const host = origin.replace(/^https?:\/\//, '')
  
  // Generate QR code URL with ?r=qr parameter for tracking
  const qrUrl = `${protocol}${host}/${slug}?r=qr`

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
