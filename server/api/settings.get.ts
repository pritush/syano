import { defineEventHandler } from 'h3'
import { loadSiteSettingsForHomepage } from '~/server/utils/site-settings'

export default defineEventHandler(async (event) => {
  return await loadSiteSettingsForHomepage(event)
})

