<script setup lang="ts">
import type { SiteSettings } from '~/shared/schemas/settings'

const event = useRequestEvent()

const { data: settings } = await useAsyncData<SiteSettings>('site-settings', async () => {
  if (import.meta.server && event?.context.siteSettings) {
    return event.context.siteSettings
  }

  return await $fetch<SiteSettings>('/api/settings')
})

const homepageMode = computed(() => settings.value?.homepage_mode || 'DEFAULT')

// Set dynamic title and meta based on homepage mode
useSeoMeta({
  title: () => {
    if (homepageMode.value === 'BIO' && settings.value?.bio_content?.profile?.name) {
      return settings.value.bio_content.profile.name
    }
    return 'Syano | Open Source URL Shortener'
  },
  description: () => {
    if (homepageMode.value === 'BIO' && settings.value?.bio_content?.profile?.bio) {
      return settings.value.bio_content.profile.bio
    }
    return 'A powerful, self-hosted URL shortener with analytics, link-in-bio pages, and advanced link management features.'
  },
  ogTitle: () => {
    if (homepageMode.value === 'BIO' && settings.value?.bio_content?.profile?.name) {
      return settings.value.bio_content.profile.name
    }
    return 'Syano | Open Source URL Shortener'
  },
  ogDescription: () => {
    if (homepageMode.value === 'BIO' && settings.value?.bio_content?.profile?.bio) {
      return settings.value.bio_content.profile.bio
    }
    return 'A powerful, self-hosted URL shortener with analytics, link-in-bio pages, and advanced link management features.'
  },
})
</script>

<template>
  <BioPage
    v-if="homepageMode === 'BIO'"
    :content="settings?.bio_content || { profile: { name: 'Syano', bio: null, initials: null, avatar_url: null }, links: [], socials: [] }"
  />
  <HomeRedirect
    v-else-if="homepageMode === 'REDIRECT'"
    :redirect-url="settings?.redirect_url || '/'"
  />
  <HomeDefault v-else />
</template>

