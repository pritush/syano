<script setup lang="ts">
import type { SiteSettings } from '~/shared/schemas/settings'

definePageMeta({
  layout: 'dashboard',
  middleware: 'dashboard-auth',
})

useHead({
  title: 'Homepage Settings | Syano Dashboard',
  meta: [
    { name: 'description', content: 'Configure your homepage mode, bio profile, and link-in-bio settings.' }
  ],
})

type BioLinkRow = {
  id: string
  title: string
  url: string
  subtitle: string
  icon: string
  color: string
}

type BioSocialRow = {
  platform: string
  url: string
}

const api = useDashboardApi()

const loading = ref(true)
const saving = ref(false)
const toasts = useToasts()

const modeCards = [
  {
    value: 'DEFAULT',
    label: 'Default',
    description: 'Default Syano site, dashboard landing page.',
  },
  {
    value: 'REDIRECT',
    label: 'Redirect',
    description: 'Redirect visitors to a specific URL.',
  },
  {
    value: 'BIO',
    label: 'Link-in-bio',
    description: 'Your curated list of links and social media.',
  },
] as const

const bioIconOptions = [
  { label: 'Link', value: 'link' },
  { label: 'Briefcase', value: 'briefcase' },
  { label: 'Newsletter', value: 'news' },
  { label: 'Calendar', value: 'calendar' },
  { label: 'Stack', value: 'layers' },
  { label: 'Mail', value: 'mail' },
  { label: 'Code', value: 'code' },
  { label: 'Sparkles', value: 'sparkles' },
]

const bioColorOptions = [
  { label: 'Brand', value: 'brand' },
  { label: 'Sky', value: 'sky' },
  { label: 'Amber', value: 'amber' },
  { label: 'Emerald', value: 'emerald' },
  { label: 'Slate', value: 'slate' },
]

const socialPlatforms = [
  { label: 'Website / Other', value: 'website' },
  { label: 'Twitter / X', value: 'twitter' },
  { label: 'Instagram', value: 'instagram' },
  { label: 'LinkedIn', value: 'linkedin' },
  { label: 'GitHub', value: 'github' },
  { label: 'YouTube', value: 'youtube' },
  { label: 'Facebook', value: 'facebook' },
  { label: 'TikTok', value: 'tiktok' },
  { label: 'Discord', value: 'discord' },
  { label: 'Reddit', value: 'reddit' },
  { label: 'WhatsApp', value: 'whatsapp' },
  { label: 'Telegram', value: 'telegram' },
  { label: 'Snapchat', value: 'snapchat' },
  { label: 'Pinterest', value: 'pinterest' },
  { label: 'Twitch', value: 'twitch' },
  { label: 'Spotify', value: 'spotify' },
  { label: 'SoundCloud', value: 'soundcloud' },
  { label: 'Medium', value: 'medium' },
  { label: 'Dribbble', value: 'dribbble' },
  { label: 'Behance', value: 'behance' },
  { label: 'Figma', value: 'figma' },
  { label: 'Patreon', value: 'patreon' },
  { label: 'Mastodon', value: 'mastodon' },
  { label: 'Email', value: 'email' },
]

const form = reactive({
  homepage_mode: 'DEFAULT' as SiteSettings['homepage_mode'],
  redirect_url: '',
  redirect_timeout: 3,
  profile_name: 'Syano',
  profile_bio: '',
  profile_initials: 'SY',
  profile_avatar_url: '',
  bio_links: [] as BioLinkRow[],
  socials: [] as BioSocialRow[],
})

const newSocialPlatform = ref('')
const newSocialUrl = ref('')
const editingLinkIndex = ref<number | null>(null)
const editingSocialIndex = ref<number | null>(null)
const deleteModalOpen = ref(false)
const deleteTarget = ref<{ type: 'link' | 'social'; index: number; name: string } | null>(null)

const deleteModalTitle = computed(() => {
  return deleteTarget.value?.type === 'social' ? 'Delete Social Profile' : 'Delete Bio Link'
})

const deleteModalDescription = computed(() => {
  const target = deleteTarget.value
  if (!target) {
    return ''
  }

  if (target.type === 'social') {
    return `Delete "${target.name}" from your social row? This action cannot be undone.`
  }

  return `Delete "${target.name}" from your bio links? This action cannot be undone.`
})

function newId() {
  return globalThis.crypto?.randomUUID?.() || `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function applySettings(settings: SiteSettings) {
  form.homepage_mode = settings.homepage_mode
  form.redirect_url = settings.redirect_url || ''
  form.redirect_timeout = settings.redirect_timeout ?? 3
  form.profile_name = settings.bio_content.profile.name
  form.profile_bio = settings.bio_content.profile.bio || ''
  form.profile_initials = settings.bio_content.profile.initials || ''
  form.profile_avatar_url = settings.bio_content.profile.avatar_url || ''
  form.bio_links = settings.bio_content.links.map((link) => ({
    id: link.id,
    title: link.title,
    url: link.url,
    subtitle: link.subtitle || '',
    icon: link.icon || 'link',
    color: link.color || 'brand',
  }))
  form.socials = settings.bio_content.socials.map((social) => ({
    platform: social.platform,
    url: social.url,
  }))
}

function formatUrl(val: string): string {
  const t = val.trim()
  if (!t) return ''
  if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(t)) return t
  return 'https://' + t
}

function buildSettingsPayload(): SiteSettings {
  return {
    homepage_mode: form.homepage_mode,
    redirect_url: formatUrl(form.redirect_url) || null,
    redirect_timeout: Number(form.redirect_timeout) || 0,
    bio_content: {
      profile: {
        name: form.profile_name.trim() || 'Syano',
        bio: form.profile_bio.trim() || null,
        initials: form.profile_initials.trim() || null,
        avatar_url: formatUrl(form.profile_avatar_url) || null,
      },
      links: form.bio_links
        .filter((link) => link.title.trim() && link.url.trim())
        .map((link) => ({
          id: link.id || newId(),
          title: link.title.trim(),
          url: formatUrl(link.url),
          subtitle: link.subtitle.trim() || null,
          icon: link.icon || 'link',
          color: link.color || 'brand',
        })),
      socials: form.socials
        .filter((social) => social.platform.trim() && social.url.trim())
        .map((social) => ({
          platform: social.platform.trim(),
          url: formatUrl(social.url),
        })),
    },
  }
}



function addBioLink() {
  form.bio_links.push({
    id: newId(),
    title: '',
    url: '',
    subtitle: '',
    icon: 'link',
    color: 'brand',
  })
  editingLinkIndex.value = form.bio_links.length - 1
  toasts.created('bio link', 'Link')
}

function editBioLink(index: number) {
  editingLinkIndex.value = index
}

function closeLinkEditor() {
  editingLinkIndex.value = null
  // Auto-save when closing editor
  save()
}

function addSocial() {
  form.socials.push({
    platform: '',
    url: '',
  })
}

function addSocialFromForm() {
  if (!newSocialPlatform.value || !newSocialUrl.value) return
  
  form.socials.push({
    platform: newSocialPlatform.value,
    url: newSocialUrl.value,
  })
  
  newSocialPlatform.value = ''
  newSocialUrl.value = ''
  
  toasts.created('social profile', 'Social')
  // Auto-save after adding social
  save()
}

function editSocial(index: number) {
  editingSocialIndex.value = index
}

function closeSocialEditor() {
  editingSocialIndex.value = null
  // Auto-save when closing editor
  save()
}

async function removeBioLink(index: number) {
  const link = form.bio_links[index]
  if (!link) {
    return
  }

  deleteTarget.value = {
    type: 'link',
    index,
    name: link.title || 'Untitled Link',
  }
  deleteModalOpen.value = true
}

async function removeSocial(index: number) {
  const social = form.socials[index]
  if (!social) {
    return
  }

  const platformLabel = socialPlatforms.find((item) => item.value === social.platform)?.label || social.platform
  deleteTarget.value = {
    type: 'social',
    index,
    name: platformLabel,
  }
  deleteModalOpen.value = true
}

function closeDeleteModal() {
  if (saving.value) {
    return
  }

  deleteModalOpen.value = false
  deleteTarget.value = null
}

async function confirmDeleteTarget() {
  const target = deleteTarget.value
  if (!target) {
    return
  }

  if (target.type === 'link') {
    const link = form.bio_links[target.index]
    if (!link) {
      closeDeleteModal()
      return
    }

    form.bio_links.splice(target.index, 1)
    toasts.deleted(target.name, 'Bio link')
    closeDeleteModal()
    await save()
    return
  }

  const social = form.socials[target.index]
  if (!social) {
    closeDeleteModal()
    return
  }

  form.socials.splice(target.index, 1)
  toasts.deleted(target.name, 'Social profile')
  closeDeleteModal()
  await save()
}

function selectMode(mode: SiteSettings['homepage_mode']) {
  form.homepage_mode = mode
}



async function loadSettings() {
  loading.value = true

  try {
    const settings = await $fetch<SiteSettings>('/api/settings')

    applySettings(settings)
  } catch (error: any) {
    toasts.error('Error', error?.data?.statusMessage || 'Unable to load site settings.')
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true

  try {
    const saved = await api.request<SiteSettings>('/api/settings', {
      method: 'PATCH',
      body: buildSettingsPayload(),
    })
    applySettings(saved)
    toasts.saved('Homepage settings')
  } catch (error: any) {
    toasts.error('Save failed', error?.data?.statusMessage || 'Unable to save homepage settings.')
  } finally {
    saving.value = false
  }
}

onMounted(loadSettings)
</script>

<template>
  <div class="space-y-6">
    <!-- Stats Header Card -->
    <UCard class="sy-surface rounded-[32px] border-0">
      <template #header>
        <div class="space-y-3">
          <h1 class="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
            Homepage Settings
          </h1>
          <p class="text-sm text-slate-600 max-w-2xl dark:text-slate-400">
            Configure how the world sees your digital identity. Select a primary mode and curate your public profile links.
          </p>
        </div>
      </template>

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div class="rounded-[20px] bg-white p-5 ring-1 ring-slate-200/70 dark:bg-slate-800/50 dark:ring-slate-700/50">
          <p class="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Active Mode
          </p>
          <p class="mt-2 text-2xl font-semibold text-brand-600 dark:text-brand-400">
            {{ form.homepage_mode === 'BIO' ? 'Link-in-bio' : form.homepage_mode === 'REDIRECT' ? 'Redirect' : 'Default' }}
          </p>
        </div>
        <div class="rounded-[20px] bg-white p-5 ring-1 ring-slate-200/70 dark:bg-slate-800/50 dark:ring-slate-700/50">
          <p class="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Public Links
          </p>
          <p class="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
            {{ form.bio_links.length }}
          </p>
        </div>
        <div class="rounded-[20px] bg-white p-5 ring-1 ring-slate-200/70 dark:bg-slate-800/50 dark:ring-slate-700/50">
          <p class="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Profile Views
          </p>
          <p class="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
            1.2k
          </p>
        </div>
        <div class="rounded-[20px] bg-white p-5 ring-1 ring-slate-200/70 dark:bg-slate-800/50 dark:ring-slate-700/50">
          <p class="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Redirect Delay
          </p>
          <p class="mt-2 text-2xl font-semibold text-accent-600 dark:text-accent-400">
            {{ form.homepage_mode === 'REDIRECT' ? form.redirect_timeout + 's' : '-' }}
          </p>
        </div>
      </div>
    </UCard>

    <!-- Configuration Card -->
    <UCard class="sy-surface rounded-[28px] border-0">
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 class="text-xl font-semibold text-slate-950 dark:text-white">
              Configuration
            </h2>
            <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Customize your homepage experience
            </p>
          </div>
          <div class="flex items-center gap-3">
            <UButton color="neutral" variant="ghost" size="lg" @click="loadSettings">
              Discard changes
            </UButton>
            <UButton :loading="saving" @click="save" size="lg" icon="lucide:save">
              Save Profile
            </UButton>
          </div>
        </div>
      </template>

      <div v-if="loading" class="space-y-3">
        <div class="h-36 animate-pulse rounded-[24px] bg-white/70 dark:bg-slate-800/50" />
        <div class="h-56 animate-pulse rounded-[24px] bg-white/70 dark:bg-slate-800/50" />
      </div>

      <form v-else class="space-y-8" @submit.prevent="save">
        <!-- Homepage Mode Selection -->
        <div>
          <h3 class="text-lg font-semibold text-slate-950 mb-1 dark:text-white">
            Homepage Mode
          </h3>
          <p class="text-sm text-slate-500 mb-5 dark:text-slate-400">
            Choose what happens when someone visits your root domain.
          </p>
          
          <div class="grid gap-4 md:grid-cols-3">
            <button
              v-for="mode in modeCards"
              :key="mode.value"
              type="button"
              class="group relative rounded-[20px] border-2 p-6 text-left transition-all duration-200"
              :class="form.homepage_mode === mode.value 
                ? 'border-brand-500 bg-brand-50 shadow-md dark:bg-brand-900/20 dark:border-brand-400' 
                : 'border-slate-200 bg-white hover:border-brand-300 hover:shadow-sm dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-brand-500'"
              @click="selectMode(mode.value)"
            >
              <div class="mb-4 flex h-12 w-12 items-center justify-center rounded-full transition-colors"
                :class="form.homepage_mode === mode.value ? 'bg-brand-100 dark:bg-brand-900/40' : 'bg-slate-100 group-hover:bg-brand-50 dark:bg-slate-700 dark:group-hover:bg-brand-900/30'">
                <UIcon 
                  :name="mode.value === 'DEFAULT' ? 'lucide:home' : mode.value === 'REDIRECT' ? 'lucide:arrow-right' : 'lucide:user'"
                  class="h-6 w-6 transition-colors"
                  :class="form.homepage_mode === mode.value ? 'text-brand-600 dark:text-brand-400' : 'text-slate-500 group-hover:text-brand-500 dark:text-slate-400 dark:group-hover:text-brand-400'"
                />
              </div>
              <h3 class="text-lg font-semibold text-slate-950 mb-2 dark:text-white">
                {{ mode.label }}
              </h3>
              <p class="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {{ mode.description }}
              </p>
              <div v-if="form.homepage_mode === mode.value" class="absolute top-4 right-4">
                <div class="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 dark:bg-brand-400">
                  <UIcon name="lucide:check" class="h-4 w-4 text-white dark:text-slate-900" />
                </div>
              </div>
            </button>
          </div>
        </div>

        <!-- Redirect Configuration -->
        <div v-if="form.homepage_mode === 'REDIRECT'" class="rounded-[24px] bg-white p-6 ring-1 ring-slate-200/70 dark:bg-slate-800/50 dark:ring-slate-700/50">
          <div class="mb-6">
            <h3 class="text-lg font-semibold text-slate-950 dark:text-white">
              Redirect Configuration
            </h3>
            <p class="text-sm text-slate-500 mt-1 dark:text-slate-400">
              Visitors will be redirected after a brief delay.
            </p>
          </div>

          <div class="space-y-5">
            <UFormField label="Target URL" class="space-y-2">
              <UInput 
                v-model="form.redirect_url" 
                type="url" 
                placeholder="https://example.com" 
                size="lg"
                class="rounded-xl"
              />
            </UFormField>

            <UFormField label="Delay (seconds)" class="space-y-2 max-w-xs">
              <UInput 
                v-model="form.redirect_timeout" 
                type="number"
                min="0"
                max="60"
                size="lg"
                class="rounded-xl"
              />
            </UFormField>
          </div>
        </div>

        <!-- BIO Mode Sections -->
        <template v-if="form.homepage_mode === 'BIO'">
          <!-- Bio Profile Settings -->
          <div class="rounded-[24px] bg-white p-6 ring-1 ring-slate-200/70 dark:bg-slate-800/50 dark:ring-slate-700/50">
            <div class="mb-6">
              <h3 class="text-lg font-semibold text-slate-950 dark:text-white">
                Bio Profile Settings
              </h3>
              <p class="text-sm text-slate-500 mt-1 dark:text-slate-400">
                Update your public identity and appearance.
              </p>
            </div>

            <div class="space-y-5">
              <div class="grid gap-5 md:grid-cols-2">
                <UFormField label="Display Name" class="space-y-2">
                  <UInput 
                    v-model="form.profile_name" 
                    placeholder="Alex Brown" 
                    size="lg"
                    class="rounded-xl"
                  />
                </UFormField>

                <UFormField label="Avatar URL" class="space-y-2">
                  <UInput 
                    v-model="form.profile_avatar_url" 
                    type="url" 
                    placeholder="https://image.url.com/avatar.jpg" 
                    size="lg"
                    class="rounded-xl"
                  />
                </UFormField>
              </div>

              <UFormField label="Short Bio" class="space-y-2">
                <UTextarea 
                  v-model="form.profile_bio" 
                  :rows="3" 
                  placeholder="Product Designer & Digital Curator. Sharing resources for the next generation of creative minds." 
                  size="lg"
                  class="rounded-xl"
                />
              </UFormField>
            </div>
          </div>

          <!-- Bio Links -->
          <div class="rounded-[24px] bg-white p-6 ring-1 ring-slate-200/70 dark:bg-slate-800/50 dark:ring-slate-700/50">
            <div class="mb-6">
              <h3 class="text-lg font-semibold text-slate-950 dark:text-white">
                Bio Links
              </h3>
              <p class="text-sm text-slate-500 mt-1 dark:text-slate-400">
                Drag to reorder the core links on your profile.
              </p>
            </div>

            <div v-if="form.bio_links.length" class="space-y-3">
              <div
                v-for="(link, index) in form.bio_links"
                :key="link.id"
                class="group relative rounded-[16px] border border-slate-200 bg-slate-50/50 transition-all dark:border-slate-700 dark:bg-slate-800/30"
                :class="editingLinkIndex === index ? 'border-brand-300 bg-white shadow-md dark:border-brand-500 dark:bg-slate-800/50' : 'hover:border-slate-300 hover:bg-white hover:shadow-sm dark:hover:border-slate-600 dark:hover:bg-slate-800/50'"
              >
                <!-- Collapsed View -->
                <div v-if="editingLinkIndex !== index" class="flex items-start gap-3 p-4">
                  <div class="flex h-10 w-10 shrink-0 cursor-move items-center justify-center rounded-lg bg-white text-slate-400 ring-1 ring-slate-200 transition-colors group-hover:text-slate-600 dark:bg-slate-700 dark:ring-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300">
                    <UIcon name="lucide:grip-vertical" class="h-5 w-5" />
                  </div>
                  
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center justify-between gap-3">
                      <div class="min-w-0 flex-1">
                        <p class="truncate font-medium text-slate-950 dark:text-white">
                          {{ link.title || 'Untitled Link' }}
                        </p>
                        <p class="truncate text-sm text-slate-500 dark:text-slate-400">
                          {{ link.url || 'No URL set' }}
                        </p>
                      </div>
                      <div class="flex items-center gap-2">
                        <button
                          type="button"
                          class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                          @click.stop="editBioLink(index)"
                        >
                          <UIcon name="lucide:pencil" class="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                          @click.stop="removeBioLink(index)"
                        >
                          <UIcon name="lucide:trash-2" class="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Expanded Edit View -->
                <div v-else class="p-5 space-y-4">
                  <div class="flex items-center justify-between mb-4">
                    <h4 class="text-base font-semibold text-slate-950 dark:text-white">Edit Link</h4>
                    <button
                      type="button"
                      class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                      @click.stop="closeLinkEditor"
                    >
                      <UIcon name="lucide:x" class="h-4 w-4" />
                    </button>
                  </div>

                  <div class="grid gap-4 md:grid-cols-2">
                    <UFormField label="Title" class="space-y-2">
                      <UInput 
                        v-model="link.title" 
                        placeholder="Portfolio 2024" 
                        size="lg"
                        class="rounded-xl"
                      />
                    </UFormField>

                    <UFormField label="URL" class="space-y-2">
                      <UInput 
                        v-model="link.url" 
                        type="url" 
                        placeholder="https://portfolio.com" 
                        size="lg"
                        class="rounded-xl"
                      />
                    </UFormField>
                  </div>

                  <UFormField label="Subtitle (optional)" class="space-y-2">
                    <UInput 
                      v-model="link.subtitle" 
                      placeholder="Check out my latest work" 
                      size="lg"
                      class="rounded-xl"
                    />
                  </UFormField>

                  <div class="grid gap-4 md:grid-cols-2">
                    <UFormField label="Icon" class="space-y-2">
                      <SySelect
                        v-model="link.icon"
                        :options="bioIconOptions"
                        buttonClass="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 transition-colors hover:border-brand-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      />
                    </UFormField>

                    <UFormField label="Color" class="space-y-2">
                      <SySelect
                        v-model="link.color"
                        :options="bioColorOptions"
                        buttonClass="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 transition-colors hover:border-brand-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      />
                    </UFormField>
                  </div>

                  <div class="flex justify-end gap-3 pt-2">
                    <UButton color="neutral" variant="ghost" @click="closeLinkEditor">
                      Done
                    </UButton>
                  </div>
                </div>
              </div>
            </div>

            <div v-else class="rounded-[16px] border-2 border-dashed border-slate-200 bg-slate-50/50 p-8 text-center dark:border-slate-700 dark:bg-slate-800/30">
              <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700">
                <UIcon name="lucide:link" class="h-6 w-6 text-slate-400 dark:text-slate-500" />
              </div>
              <p class="text-sm font-medium text-slate-600 dark:text-slate-300">No links yet</p>
              <p class="text-sm text-slate-500 dark:text-slate-400">Add your first link to get started</p>
            </div>

            <div class="mt-4 flex justify-end">
              <UButton color="primary" variant="soft" @click="addBioLink" icon="lucide:plus">
                Add New Link
              </UButton>
            </div>
          </div>

          <!-- Social Row -->
          <div class="rounded-[24px] bg-white p-6 ring-1 ring-slate-200/70 dark:bg-slate-800/50 dark:ring-slate-700/50">
            <div class="mb-6">
              <h3 class="text-lg font-semibold text-slate-950 dark:text-white">
                Social Row
              </h3>
              <p class="text-sm text-slate-500 mt-1 dark:text-slate-400">
                Manage your quick-access social media profiles.
              </p>
            </div>

            <div v-if="form.socials.length" class="mb-5 space-y-3">
              <div
                v-for="(social, index) in form.socials"
                :key="`${social.platform}-${index}`"
                class="group relative rounded-[16px] border border-slate-200 bg-slate-50/50 transition-all dark:border-slate-700 dark:bg-slate-800/30"
                :class="editingSocialIndex === index ? 'border-brand-300 bg-white shadow-md dark:border-brand-500 dark:bg-slate-800/50' : 'hover:border-slate-300 hover:bg-white hover:shadow-sm dark:hover:border-slate-600 dark:hover:bg-slate-800/50'"
              >
                <!-- Collapsed View -->
                <div v-if="editingSocialIndex !== index" class="flex items-center justify-between gap-3 p-4">
                  <div class="flex min-w-0 flex-1 items-center gap-3">
                    <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-slate-200 dark:bg-slate-700 dark:ring-slate-600">
                      <UIcon 
                        :name="`lucide:${social.platform === 'twitter' ? 'twitter' : social.platform === 'instagram' ? 'instagram' : social.platform === 'github' ? 'github' : social.platform === 'linkedin' ? 'linkedin' : social.platform === 'youtube' ? 'youtube' : 'globe'}`" 
                        class="h-5 w-5 text-slate-600 dark:text-slate-300" 
                      />
                    </div>
                    <div class="min-w-0 flex-1">
                      <p class="truncate font-medium text-slate-950 dark:text-white">
                        {{ socialPlatforms.find(p => p.value === social.platform)?.label || social.platform }}
                      </p>
                      <p class="truncate text-sm text-slate-500 dark:text-slate-400">
                        {{ social.url }}
                      </p>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                      @click.stop="editSocial(index)"
                    >
                      <UIcon name="lucide:pencil" class="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                      @click.stop="removeSocial(index)"
                    >
                      <UIcon name="lucide:trash-2" class="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <!-- Expanded Edit View -->
                <div v-else class="p-5 space-y-4">
                  <div class="flex items-center justify-between mb-4">
                    <h4 class="text-base font-semibold text-slate-950 dark:text-white">Edit Social Profile</h4>
                    <button
                      type="button"
                      class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                      @click.stop="closeSocialEditor"
                    >
                      <UIcon name="lucide:x" class="h-4 w-4" />
                    </button>
                  </div>

                  <UFormField label="Platform" class="space-y-2">
                    <SySelect
                      v-model="social.platform"
                      :options="socialPlatforms"
                      buttonClass="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 transition-colors hover:border-brand-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </UFormField>

                  <UFormField label="Username, handle, or full URL" class="space-y-2">
                    <UInput 
                      v-model="social.url" 
                      type="text" 
                      placeholder="@username or https://..." 
                      size="lg"
                      class="rounded-xl"
                    />
                  </UFormField>

                  <div class="flex justify-end gap-3 pt-2">
                    <UButton color="neutral" variant="ghost" @click="closeSocialEditor">
                      Done
                    </UButton>
                  </div>
                </div>
              </div>
            </div>

            <div v-else class="mb-5 rounded-[16px] border-2 border-dashed border-slate-200 bg-slate-50/50 p-6 text-center dark:border-slate-700 dark:bg-slate-800/30">
              <p class="text-sm text-slate-500 dark:text-slate-400">No social profiles added yet</p>
            </div>

            <div class="flex items-end gap-3">
              <div class="flex-1">
                <UFormField label="Platform" class="space-y-2">
                  <SySelect
                    v-model="newSocialPlatform"
                    :options="socialPlatforms"
                    placeholder="Select platform"
                    buttonClass="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 transition-colors hover:border-brand-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </UFormField>
              </div>
              <div class="flex-[2]">
                <UFormField label="Username, handle, or full URL" class="space-y-2">
                  <UInput 
                    v-model="newSocialUrl" 
                    type="text" 
                    placeholder="@username or https://..." 
                    size="lg"
                    class="rounded-xl"
                    @keyup.enter="addSocialFromForm"
                  />
                </UFormField>
              </div>
              <UButton 
                color="primary" 
                size="lg" 
                @click="addSocialFromForm"
                :disabled="!newSocialPlatform || !newSocialUrl"
                class="mb-0"
              >
                Add
              </UButton>
            </div>
          </div>
        </template>

        <!-- Default Mode -->
        <div v-if="form.homepage_mode === 'DEFAULT'" class="rounded-[24px] bg-white p-6 ring-1 ring-slate-200/70 dark:bg-slate-800/50 dark:ring-slate-700/50">
          <div class="mb-4">
            <h3 class="text-lg font-semibold text-slate-950 dark:text-white">
              Default Landing Page
            </h3>
            <p class="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              This keeps the polished Syano landing page at the root URL, so visitors see the product intro and a path into the dashboard.
            </p>
          </div>
        </div>
      </form>
    </UCard>
  </div>

  <!-- Delete Confirmation Modal -->
  <DashboardDeleteModal
    v-model="deleteModalOpen"
    :title="deleteModalTitle"
    :description="deleteModalDescription"
    :loading="saving"
    @confirm="confirmDeleteTarget"
    @cancel="closeDeleteModal"
  />
</template>
