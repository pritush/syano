<script setup lang="ts">
type SocialEntry = {
  platform: string
  url: string
}

type BioLink = {
  id: string
  title: string
  url: string
  subtitle?: string | null
  icon?: string | null
  color?: string | null
}

type BioContent = {
  profile: {
    name: string
    bio?: string | null
    initials?: string | null
    avatar_url?: string | null
  }
  links: BioLink[]
  socials: SocialEntry[]
}

const props = defineProps<{
  content: BioContent
}>()

const shareMessage = ref('')
const initials = computed(() => props.content.profile.initials || props.content.profile.name.slice(0, 2).toUpperCase())

// Note: Title and meta are now set in pages/index.vue for better SSR support

const bioIconMap = {
  briefcase: 'lucide:briefcase-business',
  calendar: 'lucide:calendar-days',
  code: 'lucide:terminal',
  layers: 'lucide:layers-3',
  link: 'lucide:link-2',
  mail: 'lucide:mail',
  news: 'lucide:newspaper',
  sparkles: 'lucide:sparkles',
} as const

function resolveBioIcon(icon: string | null | undefined) {
  const key = String(icon || 'link').toLowerCase() as keyof typeof bioIconMap
  return bioIconMap[key] || 'lucide:link-2'
}

function resolveBioTone(color: string | null | undefined) {
  const key = String(color || 'brand').toLowerCase()

  if (key === 'sky') {
    return 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300'
  }

  if (key === 'amber') {
    return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
  }

  if (key === 'emerald') {
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
  }

  if (key === 'slate') {
    return 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
  }

  return 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
}

function socialIcon(platform: string) {
  const key = platform.toLowerCase()

  if (key === 'twitter' || key === 'x') return 'simple-icons:x'
  if (key === 'instagram') return 'simple-icons:instagram'
  if (key === 'linkedin') return 'simple-icons:linkedin'
  if (key === 'github') return 'simple-icons:github'
  if (key === 'youtube') return 'simple-icons:youtube'
  if (key === 'facebook') return 'simple-icons:facebook'
  if (key === 'tiktok') return 'simple-icons:tiktok'
  if (key === 'discord') return 'simple-icons:discord'
  if (key === 'reddit') return 'simple-icons:reddit'
  if (key === 'whatsapp') return 'simple-icons:whatsapp'
  if (key === 'telegram') return 'simple-icons:telegram'
  if (key === 'snapchat') return 'simple-icons:snapchat'
  if (key === 'pinterest') return 'simple-icons:pinterest'
  if (key === 'twitch') return 'simple-icons:twitch'
  if (key === 'spotify') return 'simple-icons:spotify'
  if (key === 'soundcloud') return 'simple-icons:soundcloud'
  if (key === 'medium') return 'simple-icons:medium'
  if (key === 'dribbble') return 'simple-icons:dribbble'
  if (key === 'behance') return 'simple-icons:behance'
  if (key === 'figma') return 'simple-icons:figma'
  if (key === 'patreon') return 'simple-icons:patreon'
  if (key === 'mastodon') return 'simple-icons:mastodon'
  if (key === 'email' || key === 'mail') return 'lucide:mail'

  return 'lucide:globe'
}

async function shareProfile() {
  if (!import.meta.client) {
    return
  }

  const shareUrl = window.location.href

  if (navigator.share) {
    await navigator.share({
      title: props.content.profile.name,
      text: props.content.profile.bio || props.content.profile.name,
      url: shareUrl,
    })
    return
  }

  await navigator.clipboard.writeText(shareUrl)
  shareMessage.value = 'Profile link copied.'

  window.setTimeout(() => {
    shareMessage.value = ''
  }, 2400)
}
</script>

<template>
  <UContainer class="mx-auto flex min-h-screen max-w-3xl items-start justify-center px-5 py-12 sm:py-18">
    <div class="w-full max-w-xl space-y-8">
      <section class="space-y-5 text-center">
        <div class="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-brand-700 text-3xl font-semibold text-white shadow-xl shadow-brand-950/15 dark:bg-brand-600 dark:shadow-brand-950/30">
          <img
            v-if="content.profile.avatar_url"
            :src="content.profile.avatar_url"
            :alt="content.profile.name"
            class="h-full w-full rounded-full object-cover"
            loading="eager"
            fetchpriority="high"
          >
          <span v-else>{{ initials }}</span>
        </div>

        <div class="space-y-3">
          <h1 class="text-4xl font-semibold tracking-tight text-slate-950 dark:text-white">
            {{ content.profile.name }}
          </h1>
          <p v-if="content.profile.bio" class="mx-auto max-w-lg text-sm leading-7 text-slate-600 dark:text-slate-300 sm:text-base">
            {{ content.profile.bio }}
          </p>
        </div>
      </section>

      <ul class="space-y-4">
        <li v-for="link in content.links" :key="link.id">
          <a
            :href="link.url"
            target="_blank"
            rel="noopener noreferrer"
            class="sy-surface group flex items-center gap-4 rounded-[26px] px-4 py-4 transition duration-200 hover:-translate-y-0.5"
          >
            <div
              class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
              :class="resolveBioTone(link.color)"
            >
              <UIcon :name="resolveBioIcon(link.icon)" class="h-5 w-5" />
            </div>

            <div class="min-w-0 flex-1 text-left">
              <p class="truncate text-base font-semibold text-slate-950 dark:text-white">
                {{ link.title }}
              </p>
              <p v-if="link.subtitle" class="truncate text-sm text-slate-500 dark:text-slate-400">
                {{ link.subtitle }}
              </p>
            </div>

            <UIcon name="lucide:external-link" class="h-5 w-5 shrink-0 text-slate-400 transition group-hover:text-brand-600 dark:text-slate-500 dark:group-hover:text-brand-400" />
          </a>
        </li>
      </ul>

      <section v-if="content.socials.length" class="space-y-4 text-center">
        <p class="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
          Connect with me
        </p>
        <div class="flex flex-wrap items-center justify-center gap-3">
          <a
            v-for="social in content.socials"
            :key="social.url"
            :href="social.url"
            target="_blank"
            rel="noopener noreferrer"
            :aria-label="social.platform"
            class="inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700 shadow-sm transition hover:bg-brand-600 hover:text-white dark:bg-brand-900/30 dark:text-brand-300 dark:hover:bg-brand-600 dark:hover:text-white"
          >
            <UIcon :name="socialIcon(social.platform)" class="h-5 w-5" />
          </a>
        </div>
      </section>

      <div class="space-y-3 text-center">
        <UButton size="xl" class="rounded-full px-7" @click="shareProfile">
          Share profile
        </UButton>
        <p v-if="shareMessage" class="text-sm font-medium text-brand-700 dark:text-brand-400">
          {{ shareMessage }}
        </p>
      </div>
    </div>
  </UContainer>
</template>
