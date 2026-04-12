import type { SiteSettings } from '~/shared/schemas/settings'
import type { StoredLink } from '~/server/utils/link-store'

declare module 'h3' {
  interface H3EventContext {
    siteSettings?: SiteSettings
    link?: StoredLink
  }
}

export {}

