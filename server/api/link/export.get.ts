import { defineEventHandler, setHeader } from 'h3'
import { exportLinks } from '~/server/utils/link-store'

export default defineEventHandler(async (event) => {
  setHeader(event, 'content-type', 'application/json; charset=utf-8')

  return {
    exported_at: new Date().toISOString(),
    items: await exportLinks(event),
  }
})

