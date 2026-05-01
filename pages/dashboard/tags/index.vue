<script setup lang="ts">
definePageMeta({
  layout: 'dashboard',
  middleware: 'dashboard-auth',
})

useHead({
  title: 'Tags | Syano Dashboard',
  meta: [
    { name: 'description', content: 'Create and manage tags to organize your shortened links.' }
  ],
})

type TagItem = {
  id: string
  name: string
  link_count: number
}

const api = useDashboardApi()
const toasts = useToasts()
const { can } = useCurrentUser()

const tags = ref<TagItem[]>([])
const loadingTags = ref(true)
const creatingTag = ref(false)
const tagName = ref('')
const statusMessage = ref('')
const errorMessage = ref('')
const deleteModalOpen = ref(false)
const deletingTagId = ref<string | null>(null)
const pendingDeleteTag = ref<{ id: string; name: string } | null>(null)
const deleteModalDescription = computed(() => {
  if (!pendingDeleteTag.value) {
    return ''
  }

  return `Delete "${pendingDeleteTag.value.name}"? Links using this tag will be detached.`
})

async function loadTags() {
  loadingTags.value = true
  try {
    const response = await api.listTags()
    tags.value = response.data
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || 'Unable to load tags.'
  } finally {
    loadingTags.value = false
  }
}

async function createTag() {
  if (!tagName.value.trim()) {
    return
  }

  creatingTag.value = true
  statusMessage.value = ''
  errorMessage.value = ''

  try {
    await api.createTag({ name: tagName.value.trim() })

    tagName.value = ''
    await loadTags()
    toasts.created('tag', 'Tag')
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || 'Unable to create tag.'
    toasts.error('Creation failed', error?.data?.statusMessage || 'Unable to create tag.')
  } finally {
    creatingTag.value = false
  }
}

function requestDeleteTag(tag: TagItem) {
  pendingDeleteTag.value = {
    id: tag.id,
    name: tag.name,
  }
  deleteModalOpen.value = true
}

function closeDeleteModal() {
  if (deletingTagId.value) {
    return
  }

  deleteModalOpen.value = false
  pendingDeleteTag.value = null
}

async function confirmDeleteTag() {
  const tag = pendingDeleteTag.value
  if (!tag) {
    return
  }

  deletingTagId.value = tag.id
  statusMessage.value = ''
  errorMessage.value = ''

  try {
    await api.deleteTag(tag.id)

    await loadTags()
    toasts.deleted(`"${tag.name}"`, 'Tag')
    closeDeleteModal()
  } catch (error: any) {
    errorMessage.value = error?.data?.statusMessage || error?.data?.message || 'Unable to delete tag.'
    toasts.error('Delete failed', error?.data?.statusMessage || error?.data?.message || 'Unable to delete tag.')
  } finally {
    deletingTagId.value = null
  }
}

onMounted(loadTags)
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
          Tags
        </h1>
        <p class="mt-2 text-slate-500 dark:text-slate-400">
          Manage link categorization and grouping tags across the platform.
        </p>
      </div>
    </div>

    <!-- Feedback messages -->
    <div v-if="statusMessage" class="rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-medium text-brand-700 dark:border-brand-800/30 dark:bg-brand-900/20 dark:text-brand-400">
      {{ statusMessage }}
    </div>
    <div v-if="errorMessage" class="rounded-2xl border border-accent-200 bg-accent-50 px-4 py-3 text-sm font-medium text-accent-700 dark:border-accent-800/30 dark:bg-accent-900/20 dark:text-accent-400">
      {{ errorMessage }}
    </div>

    <div class="grid gap-6 lg:grid-cols-3">
      <!-- Create new tag -->
      <UCard v-if="can('tags:manage')" class="sy-surface rounded-[24px] border border-slate-200 shadow-sm dark:border-slate-800">
        <template #header>
          <h2 class="text-lg font-semibold text-slate-900 dark:text-white">
            Create Tag
          </h2>
        </template>
        <form class="space-y-4" @submit.prevent="createTag">
          <div class="space-y-2">
            <label class="text-sm font-medium text-slate-700 dark:text-slate-300">Name</label>
            <UInput v-model="tagName" placeholder="e.g. Campaign, Marketing" />
          </div>
          <UButton type="submit" :loading="creatingTag" class="w-full justify-center">
            Create Tag
          </UButton>
        </form>
      </UCard>

      <!-- Manage existing tags -->
      <UCard class="sy-surface rounded-[24px] border border-slate-200 shadow-sm dark:border-slate-800" :class="can('tags:manage') ? 'lg:col-span-2' : 'lg:col-span-3'">
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold text-slate-900 dark:text-white">
              Existing Tags
            </h2>
            <UBadge variant="soft" color="primary">
              {{ tags.length }} Total
            </UBadge>
          </div>
        </template>

        <div v-if="loadingTags" class="space-y-3 p-4">
          <div v-for="placeholder in 3" :key="placeholder" class="h-16 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800/50" />
        </div>

        <div v-else-if="tags.length" class="space-y-3">
          <div
            v-for="tag in tags"
            :key="tag.id"
            class="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-slate-300 dark:border-slate-700/50 dark:bg-slate-800/20 dark:hover:border-slate-600"
          >
            <div class="flex items-center gap-3">
              <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-brand-100 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400">
                <UIcon name="lucide:tag" class="h-5 w-5" />
              </div>
              <div>
                <p class="font-medium text-slate-900 dark:text-slate-100">
                  {{ tag.name }}
                </p>
                <p class="text-sm text-slate-500 dark:text-slate-400">
                  Used by {{ tag.link_count }} link{{ tag.link_count !== 1 ? 's' : '' }}
                </p>
              </div>
            </div>
            
            <UButton
              v-if="can('tags:manage')"
              color="error"
              variant="soft"
              size="sm"
              icon="lucide:trash-2"
              @click="requestDeleteTag(tag)"
            >
              Delete
            </UButton>
          </div>
        </div>

        <div v-else class="flex flex-col items-center justify-center rounded-[20px] border border-dashed border-slate-300 m-4 py-12 text-center dark:border-slate-700">
          <div class="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
            <UIcon name="lucide:tag" class="h-6 w-6 text-slate-400 dark:text-slate-500" />
          </div>
          <p class="text-sm font-medium text-slate-900 dark:text-white">No tags found</p>
          <p class="text-sm text-slate-500 dark:text-slate-400">Create a tag to start organizing your links.</p>
        </div>
      </UCard>
    </div>

  </div>

  <!-- Delete Confirmation Modal -->
  <DashboardDeleteModal
    v-model="deleteModalOpen"
    title="Delete Tag"
    :description="deleteModalDescription"
    :loading="Boolean(deletingTagId && pendingDeleteTag && deletingTagId === pendingDeleteTag.id)"
    confirm-label="Delete Tag"
    @confirm="confirmDeleteTag"
    @cancel="closeDeleteModal"
  />
</template>
