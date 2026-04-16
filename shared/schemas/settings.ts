import { z } from 'zod'

export const HomepageModeSchema = z.enum(['DEFAULT', 'REDIRECT', 'BIO'])

export const BioProfileSchema = z.object({
  name: z.string().trim().min(1).max(120).default('Syano'),
  bio: z.string().trim().max(280).nullish().transform((value) => value || null),
  initials: z.string().trim().max(8).nullish().transform((value) => value || null),
  avatar_url: z.string().url().nullish().transform((value) => value || null),
})

export const BioLinkSchema = z.object({
  id: z.string().trim().min(1).max(64),
  title: z.string().trim().min(1).max(120),
  url: z.string().url(),
  subtitle: z.string().trim().max(180).nullish().transform((value) => value || null),
  icon: z.string().trim().max(64).nullish().transform((value) => value || null),
  color: z.string().trim().max(64).nullish().transform((value) => value || null),
})

export const BioSocialSchema = z.object({
  platform: z.string().trim().min(1).max(50),
  url: z.string().url(),
})

export const BioContentSchema = z.object({
  profile: BioProfileSchema.default({ name: 'Syano', bio: null, initials: null, avatar_url: null }),
  links: z.array(BioLinkSchema).default([]),
  socials: z.array(BioSocialSchema).default([]),
})

export const SiteSettingsSchema = z.object({
  homepage_mode: HomepageModeSchema.default('DEFAULT'),
  redirect_url: z.string().url().nullish().transform((value) => value || null),
  redirect_timeout: z.number().min(0).max(60).default(3),
  bio_content: BioContentSchema.default({
    profile: { name: 'Syano', bio: null, initials: null, avatar_url: null },
    links: [],
    socials: [],
  }),
})

export type HomepageMode = z.infer<typeof HomepageModeSchema>
export type BioContent = z.infer<typeof BioContentSchema>
export type SiteSettings = z.infer<typeof SiteSettingsSchema>

export function createDefaultSiteSettings(): SiteSettings {
  return SiteSettingsSchema.parse({
    homepage_mode: 'DEFAULT',
    redirect_url: null,
    redirect_timeout: 3,
    bio_content: {
      profile: {
        name: 'Syano',
        bio: 'Your self-hosted short-link homepage.',
        initials: 'SY',
        avatar_url: null,
      },
      links: [],
      socials: [],
    },
  })
}

