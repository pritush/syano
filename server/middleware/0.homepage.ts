import { defineEventHandler, getRequestURL } from 'h3'
import { loadSiteSettingsForHomepage } from '~/server/utils/site-settings'

export default defineEventHandler(async (event) => {
  if (getRequestURL(event).pathname !== '/') {
    return
  }

  event.context.siteSettings = await loadSiteSettingsForHomepage(event)
})

