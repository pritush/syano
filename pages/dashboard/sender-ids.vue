<script setup lang="ts">
import type { SiteSettings } from '~/shared/schemas/settings'

definePageMeta({
  layout: 'dashboard',
  middleware: 'dashboard-auth',
})

useHead({
  title: 'URL Sender ID Settings | Syano Dashboard',
  meta: [
    { name: 'description', content: 'Configure TRAI India SMS compliance sender IDs for your short links.' }
  ],
})

type SenderIdItem = {
  id: string
  name: string
  description: string | null
  is_active: boolean
  is_default: boolean
  created_at: string
}

const api = useDashboardApi()
const toasts = useToasts()

const loading = ref(true)
const saving = ref(false)
const traiEnabled = ref(false)
const senderIds = ref<SenderIdItem[]>([])

// New sender ID form
const newName = ref('')
const newDescription = ref('')
const addingSenderId = ref(false)

// Edit state
const editingId = ref<string | null>(null)
const editName = ref('')
const editDescription = ref('')

// Delete modal
const deleteModalOpen = ref(false)
const deleteTarget = ref<SenderIdItem | null>(null)
const deleting = ref(false)

// Validation
const nameError = computed(() => {
  const val = newName.value.toUpperCase()
  if (!val) return ''
  if (val.length !== 6) return 'Must be exactly 6 characters'
  if (!/^[A-Z]{6}$/.test(val)) return 'Only uppercase letters A-Z allowed'
  return ''
})

const editNameError = computed(() => {
  const val = editName.value.toUpperCase()
  if (!val) return ''
  if (val.length !== 6) return 'Must be exactly 6 characters'
  if (!/^[A-Z]{6}$/.test(val)) return 'Only uppercase letters A-Z allowed'
  return ''
})

const canAdd = computed(() => {
  const val = newName.value.toUpperCase()
  return val.length === 6 && /^[A-Z]{6}$/.test(val) && !addingSenderId.value
})

async function loadData() {
  loading.value = true
  try {
    const [settings, senderIdsResponse] = await Promise.all([
      $fetch<SiteSettings>('/api/settings'),
      api.listSenderIds(),
    ])
    traiEnabled.value = settings.trai_sms_enabled
    senderIds.value = senderIdsResponse.data
  } catch (error: any) {
    toasts.error('Error', error?.data?.statusMessage || 'Unable to load settings.')
  } finally {
    loading.value = false
  }
}

async function toggleTRAI() {
  saving.value = true
  try {
    const settings = await $fetch<SiteSettings>('/api/settings')
    await api.request<SiteSettings>('/api/settings', {
      method: 'PATCH',
      body: {
        ...settings,
        trai_sms_enabled: !traiEnabled.value,
      },
    })
    traiEnabled.value = !traiEnabled.value
    toasts.saved('TRAI SMS compliance setting')
  } catch (error: any) {
    toasts.error('Error', error?.data?.statusMessage || 'Unable to update setting.')
  } finally {
    saving.value = false
  }
}

async function addSenderId() {
  if (!canAdd.value) return
  addingSenderId.value = true
  try {
    const response = await api.createSenderId({
      name: newName.value.toUpperCase(),
      description: newDescription.value.trim() || undefined,
    })
    senderIds.value.unshift(response.data)
    newName.value = ''
    newDescription.value = ''
    toasts.created(response.data.name, 'Sender ID')
  } catch (error: any) {
    toasts.error('Error', error?.data?.statusMessage || error?.data?.message || 'Unable to create sender ID.')
  } finally {
    addingSenderId.value = false
  }
}

function startEdit(item: SenderIdItem) {
  editingId.value = item.id
  editName.value = item.name
  editDescription.value = item.description || ''
}

function cancelEdit() {
  editingId.value = null
  editName.value = ''
  editDescription.value = ''
}

async function saveEdit(item: SenderIdItem) {
  if (editNameError.value) return
  saving.value = true
  try {
    const response = await api.updateSenderId(item.id, {
      name: editName.value.toUpperCase(),
      description: editDescription.value.trim() || null,
    })
    const index = senderIds.value.findIndex(s => s.id === item.id)
    if (index >= 0) {
      senderIds.value[index] = response.data
    }
    editingId.value = null
    toasts.saved('Sender ID')
  } catch (error: any) {
    toasts.error('Error', error?.data?.statusMessage || error?.data?.message || 'Unable to update sender ID.')
  } finally {
    saving.value = false
  }
}

async function toggleActive(item: SenderIdItem) {
  try {
    const response = await api.updateSenderId(item.id, {
      is_active: !item.is_active,
    })
    const index = senderIds.value.findIndex(s => s.id === item.id)
    if (index >= 0) {
      senderIds.value[index] = response.data
    }
    toasts.saved(`Sender ID ${response.data.is_active ? 'activated' : 'deactivated'}`)
  } catch (error: any) {
    toasts.error('Error', error?.data?.statusMessage || 'Unable to update sender ID.')
  }
}

async function setAsDefault(item: SenderIdItem) {
  try {
    const response = await api.updateSenderId(item.id, {
      is_default: true,
    })
    // Update local state to make this one default and others not
    senderIds.value = senderIds.value.map(s => ({
      ...s,
      is_default: s.id === item.id ? true : false
    }))
    toasts.saved(`Sender ID ${response.data.name} set as default`)
  } catch (error: any) {
    toasts.error('Error', error?.data?.statusMessage || 'Unable to set sender ID as default.')
  }
}

function confirmDelete(item: SenderIdItem) {
  deleteTarget.value = item
  deleteModalOpen.value = true
}

function closeDeleteModal() {
  deleteModalOpen.value = false
  deleteTarget.value = null
}

async function executeDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await api.deleteSenderId(deleteTarget.value.id)
    senderIds.value = senderIds.value.filter(s => s.id !== deleteTarget.value?.id)
    toasts.deleted(deleteTarget.value.name, 'Sender ID')
    closeDeleteModal()
  } catch (error: any) {
    toasts.error('Error', error?.data?.statusMessage || error?.data?.message || 'Unable to delete sender ID.')
  } finally {
    deleting.value = false
  }
}

onMounted(loadData)
</script>

<template>
  <div class="space-y-6">
    <!-- Header Card -->
    <UCard class="sy-surface rounded-[32px] border-0">
      <template #header>
        <div class="space-y-3">
          <div class="flex items-center gap-3">
            <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 dark:bg-brand-900/40">
              <UIcon name="lucide:radio-tower" class="h-5 w-5 text-brand-600 dark:text-brand-400" />
            </div>
            <div>
              <h1 class="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
                URL Sender ID Settings
              </h1>
              <p class="text-sm text-slate-600 dark:text-slate-400">
                TRAI India SMS Compliance Configuration
              </p>
            </div>
          </div>
        </div>
      </template>

      <!-- Info Banner -->
      <div class="rounded-[20px] bg-gradient-to-r from-amber-50 to-orange-50 p-5 ring-1 ring-amber-200/50 dark:from-amber-950/30 dark:to-orange-950/30 dark:ring-amber-800/30">
        <div class="flex gap-4">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
            <UIcon name="lucide:info" class="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div class="space-y-2">
            <h3 class="text-sm font-semibold text-amber-900 dark:text-amber-200">
              What is TRAI SMS Compliance?
            </h3>
            <p class="text-sm leading-relaxed text-amber-800/90 dark:text-amber-300/90">
              India's Telecom Regulatory Authority (TRAI) requires all promotional and transactional SMS messages to include a registered
              <strong>6-character Sender ID</strong> (also called "SMS Header"). When this feature is enabled, your short links
              will include the Sender ID as a URL path prefix — e.g.,
              <code class="rounded bg-amber-200/60 px-1.5 py-0.5 text-xs font-mono dark:bg-amber-800/40">domain.com/SENDER/x10sd</code>.
            </p>
            <p class="text-xs text-amber-700/80 dark:text-amber-400/70">
              <strong>Not from India?</strong> You can safely ignore this feature. It is completely optional and disabled by default.
              Enabling or disabling it will not affect any existing standard links.
            </p>
          </div>
        </div>
      </div>
    </UCard>

    <!-- Toggle Card -->
    <UCard class="sy-surface rounded-[28px] border-0">
      <div class="flex items-center justify-between gap-4 p-1">
        <div class="flex items-center gap-4">
          <div class="flex h-12 w-12 items-center justify-center rounded-2xl transition-colors"
            :class="traiEnabled
              ? 'bg-brand-100 dark:bg-brand-900/40'
              : 'bg-slate-100 dark:bg-slate-800'"
          >
            <UIcon
              name="lucide:shield-check"
              class="h-6 w-6 transition-colors"
              :class="traiEnabled
                ? 'text-brand-600 dark:text-brand-400'
                : 'text-slate-400 dark:text-slate-500'"
            />
          </div>
          <div>
            <p class="text-base font-semibold text-slate-950 dark:text-white">
              Enable TRAI SMS Compliance (India)
            </p>
            <p class="text-sm text-slate-500 dark:text-slate-400">
              {{ traiEnabled
                ? 'Active — new links require a Sender ID prefix'
                : 'Disabled — links use standard short format'
              }}
            </p>
          </div>
        </div>
        <button
          type="button"
          class="sy-toggle-track"
          :class="{ 'is-on': traiEnabled }"
          :disabled="saving || loading"
          @click="toggleTRAI"
          aria-label="Toggle TRAI SMS Compliance"
        >
          <div class="sy-toggle-thumb" />
        </button>
      </div>
    </UCard>

    <!-- Sender ID Management (visible when enabled) -->
    <template v-if="traiEnabled">
      <!-- Add New Sender ID Card -->
      <UCard class="sy-surface rounded-[28px] border-0">
        <template #header>
          <div>
            <h2 class="text-xl font-semibold text-slate-950 dark:text-white">
              Add Sender ID
            </h2>
            <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Register your approved 6-character TRAI Sender ID / SMS Header
            </p>
          </div>
        </template>

        <form class="space-y-4" @submit.prevent="addSenderId">
          <div class="grid gap-4 md:grid-cols-2">
            <div class="space-y-2">
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300" for="sender-id-name">
                Sender ID
                <span class="text-red-500">*</span>
              </label>
              <div class="relative">
                <input
                  id="sender-id-name"
                  v-model="newName"
                  type="text"
                  maxlength="6"
                  placeholder="SENDER"
                  class="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-mono uppercase tracking-widest text-slate-900 placeholder-slate-400 transition-colors focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-brand-500 dark:focus:ring-brand-900/30"
                  @input="newName = ($event.target as HTMLInputElement).value.toUpperCase()"
                />
                <div class="absolute right-3 top-1/2 -translate-y-1/2">
                  <span
                    class="rounded-md px-2 py-0.5 text-xs font-medium"
                    :class="newName.length === 6 && !nameError
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'"
                  >
                    {{ newName.length }}/6
                  </span>
                </div>
              </div>
              <p v-if="nameError" class="text-xs text-red-500">{{ nameError }}</p>
              <p v-else class="text-xs text-slate-500 dark:text-slate-400">
                Exactly 6 uppercase letters (A-Z). Example: SENDER, HDFCBK, AIRTEL
              </p>
            </div>

            <div class="space-y-2">
              <label class="block text-sm font-medium text-slate-700 dark:text-slate-300" for="sender-id-desc">
                Description
                <span class="text-slate-400">(optional)</span>
              </label>
              <input
                id="sender-id-desc"
                v-model="newDescription"
                type="text"
                placeholder="e.g., Description, eg marketing, transactional"
                class="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-brand-500 dark:focus:ring-brand-900/30"
              />
            </div>
          </div>

          <div class="flex justify-end">
            <UButton
              type="submit"
              :loading="addingSenderId"
              :disabled="!canAdd"
              icon="lucide:plus"
              size="lg"
            >
              Add Sender ID
            </UButton>
          </div>
        </form>
      </UCard>

      <!-- Sender IDs List Card -->
      <UCard class="sy-surface rounded-[28px] border-0">
        <template #header>
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-xl font-semibold text-slate-950 dark:text-white">
                Registered Sender IDs
              </h2>
              <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {{ senderIds.length }} Sender ID{{ senderIds.length !== 1 ? 's' : '' }} registered
              </p>
            </div>
          </div>
        </template>

        <!-- Loading State -->
        <div v-if="loading" class="space-y-3">
          <div class="h-20 animate-pulse rounded-[16px] bg-white/70 dark:bg-slate-800/50" />
          <div class="h-20 animate-pulse rounded-[16px] bg-white/70 dark:bg-slate-800/50" />
        </div>

        <!-- Empty State -->
        <div v-else-if="!senderIds.length" class="rounded-[16px] border-2 border-dashed border-slate-200 bg-slate-50/50 p-8 text-center dark:border-slate-700 dark:bg-slate-800/30">
          <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700">
            <UIcon name="lucide:radio-tower" class="h-6 w-6 text-slate-400 dark:text-slate-500" />
          </div>
          <p class="text-sm font-medium text-slate-600 dark:text-slate-300">No Sender IDs yet</p>
          <p class="text-sm text-slate-500 dark:text-slate-400">Add your first TRAI-approved Sender ID above</p>
        </div>

        <!-- Sender ID List -->
        <div v-else class="space-y-3">
          <div
            v-for="item in senderIds"
            :key="item.id"
            class="group relative rounded-[16px] border border-slate-200 bg-slate-50/50 transition-all dark:border-slate-700 dark:bg-slate-800/30"
            :class="editingId === item.id
              ? 'border-brand-300 bg-white shadow-md dark:border-brand-500 dark:bg-slate-800/50'
              : 'hover:border-slate-300 hover:bg-white hover:shadow-sm dark:hover:border-slate-600 dark:hover:bg-slate-800/50'"
          >
            <!-- Collapsed View -->
            <div v-if="editingId !== item.id" class="flex items-center justify-between gap-4 p-4">
              <div class="flex items-center gap-4 min-w-0 flex-1">
                <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl font-mono text-sm font-bold tracking-widest transition-colors"
                  :class="item.is_active
                    ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
                    : 'bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500'"
                >
                  {{ item.name.slice(0, 3) }}
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <p class="font-mono text-base font-semibold tracking-wider text-slate-950 dark:text-white">
                      {{ item.name }}
                    </p>
                    <span
                      class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                      :class="item.is_active
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'"
                    >
                      {{ item.is_active ? 'Active' : 'Inactive' }}
                    </span>
                    <span
                      v-if="item.is_default"
                      class="inline-flex items-center rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
                    >
                      Default
                    </span>
                  </div>
                  <p v-if="item.description" class="truncate text-sm text-slate-500 dark:text-slate-400">
                    {{ item.description }}
                  </p>
                  <p v-else class="text-sm text-slate-400 italic dark:text-slate-500">
                    No description
                  </p>
                </div>
              </div>

              <div class="flex items-center gap-1.5">
                <button
                  v-if="!item.is_default"
                  type="button"
                  class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-slate-700 dark:hover:text-brand-400"
                  title="Set as Default"
                  @click="setAsDefault(item)"
                >
                  <UIcon name="lucide:star" class="h-4 w-4" />
                </button>
                <button
                  type="button"
                  class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                  :title="item.is_active ? 'Deactivate' : 'Activate'"
                  @click="toggleActive(item)"
                >
                  <UIcon :name="item.is_active ? 'lucide:pause' : 'lucide:play'" class="h-4 w-4" />
                </button>
                <button
                  type="button"
                  class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                  title="Edit"
                  @click="startEdit(item)"
                >
                  <UIcon name="lucide:pencil" class="h-4 w-4" />
                </button>
                <button
                  type="button"
                  class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                  title="Delete"
                  @click="confirmDelete(item)"
                >
                  <UIcon name="lucide:trash-2" class="h-4 w-4" />
                </button>
              </div>
            </div>

            <!-- Expanded Edit View -->
            <div v-else class="p-5 space-y-4">
              <div class="flex items-center justify-between mb-2">
                <h4 class="text-base font-semibold text-slate-950 dark:text-white">Edit Sender ID</h4>
                <button
                  type="button"
                  class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                  @click="cancelEdit"
                >
                  <UIcon name="lucide:x" class="h-4 w-4" />
                </button>
              </div>

              <div class="grid gap-4 md:grid-cols-2">
                <div class="space-y-2">
                  <label class="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Sender ID
                  </label>
                  <input
                    v-model="editName"
                    type="text"
                    maxlength="6"
                    class="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-mono uppercase tracking-widest text-slate-900 placeholder-slate-400 transition-colors focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-brand-500 dark:focus:ring-brand-900/30"
                    @input="editName = ($event.target as HTMLInputElement).value.toUpperCase()"
                  />
                  <p v-if="editNameError" class="text-xs text-red-500">{{ editNameError }}</p>
                </div>

                <div class="space-y-2">
                  <label class="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Description
                  </label>
                  <input
                    v-model="editDescription"
                    type="text"
                    class="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 transition-colors focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-brand-500 dark:focus:ring-brand-900/30"
                  />
                </div>
              </div>

              <div class="flex justify-end gap-3">
                <UButton color="neutral" variant="ghost" @click="cancelEdit">
                  Cancel
                </UButton>
                <UButton :loading="saving" :disabled="!!editNameError" @click="saveEdit(item)">
                  Save Changes
                </UButton>
              </div>
            </div>
          </div>
        </div>
      </UCard>

      <!-- URL Format Preview -->
      <UCard class="sy-surface rounded-[28px] border-0">
        <div class="rounded-[20px] bg-gradient-to-r from-slate-50 to-slate-100 p-5 ring-1 ring-slate-200/50 dark:from-slate-800/50 dark:to-slate-800/30 dark:ring-slate-700/50">
          <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
            URL Format Preview
          </h3>
          <div class="space-y-2">
            <div class="flex items-center gap-3">
              <span class="rounded-md bg-green-100 px-2 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">TRAI</span>
              <code class="text-sm font-mono text-slate-800 dark:text-slate-200">
                your-domain.com/<span class="text-brand-600 dark:text-brand-400 font-bold">{{ senderIds[0]?.name || 'ABCDEF' }}</span>/x10sd
              </code>
            </div>
            <div class="flex items-center gap-3">
              <span class="rounded-md bg-slate-200 px-2 py-1 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">STD</span>
              <code class="text-sm font-mono text-slate-800 dark:text-slate-200">
                your-domain.com/x10sd
              </code>
            </div>
          </div>
          <p class="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Both formats will work for redirection. The Sender ID prefix is inserted automatically when TRAI mode is enabled.
          </p>
        </div>
      </UCard>
    </template>

    <!-- Delete Confirmation Modal -->
    <UModal v-model:open="deleteModalOpen">
      <template #content>
        <div class="p-6 space-y-5">
          <div class="flex items-center gap-3">
            <div class="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
              <UIcon name="lucide:alert-triangle" class="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 class="text-lg font-semibold text-slate-950 dark:text-white">
                Delete Sender ID
              </h3>
              <p class="text-sm text-slate-500 dark:text-slate-400">
                This action cannot be undone
              </p>
            </div>
          </div>

          <p class="text-sm text-slate-600 dark:text-slate-300">
            Are you sure you want to delete Sender ID
            <strong class="font-mono">{{ deleteTarget?.name }}</strong>?
            Links using this Sender ID will have their sender reference removed.
          </p>

          <div class="flex justify-end gap-3">
            <UButton color="neutral" variant="ghost" :disabled="deleting" @click="closeDeleteModal">
              Cancel
            </UButton>
            <UButton color="error" :loading="deleting" @click="executeDelete">
              Delete
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
