<script setup lang="ts">
import {
  ALL_PERMISSIONS,
  PERMISSION_CATEGORIES,
  PRESET_ROLES,
  matchPresetRole,
  type PermissionKey,
  type PresetRole,
} from '~/shared/permissions'

definePageMeta({ layout: 'dashboard' })
useHead({ title: 'User Management — Syano' })

const { request } = useDashboardApi()
const toasts = useToasts()

// ── State ─────────────────────────────────────────
interface UserRow {
  id: string
  username: string
  displayName: string | null
  permissions: string[]
  isActive: boolean
  createdAt: string
}

const users = ref<UserRow[]>([])
const loading = ref(true)

// Modal state
const showModal = ref(false)
const modalMode = ref<'create' | 'edit'>('create')
const editingUser = ref<UserRow | null>(null)
const saveSuccess = ref(false) // inline save banner
let saveSuccessTimer: ReturnType<typeof setTimeout> | null = null

// Form
const form = reactive({
  username: '',
  displayName: '',
  password: '',
  confirmPassword: '',
  permissions: [] as string[],
})
const formErrors = ref<Record<string, string>>({})
const submitting = ref(false)

// Delete state
const showDeleteConfirm = ref(false)
const deletingUser = ref<UserRow | null>(null)
const deleteConfirmName = ref('')
const deleting = ref(false)

// ── Data Fetching ─────────────────────────────────
async function fetchUsers() {
  loading.value = true
  try {
    const data = await request<UserRow[]>('/api/users/list')
    users.value = data
  } catch (err: any) {
    toasts.error('Failed to load users', err?.data?.statusMessage || 'Unknown error')
  } finally {
    loading.value = false
  }
}

onMounted(fetchUsers)

// ── Role Matching ─────────────────────────────────
function getUserRole(permissions: string[]): PresetRole | null {
  return matchPresetRole(permissions as PermissionKey[])
}

function getRoleBadgeColor(permissions: string[]): string {
  const role = getUserRole(permissions)
  if (!role) return 'neutral'
  const map: Record<string, string> = {
    viewer: 'info',
    editor: 'warning',
    manager: 'primary',
    admin: 'error',
  }
  return map[role.id] || 'neutral'
}

function getRoleLabel(permissions: string[]): string {
  const role = getUserRole(permissions)
  return role?.label || 'Custom'
}

// ── Permission Form ───────────────────────────────
const selectedPreset = computed(() => matchPresetRole(form.permissions as PermissionKey[]))

function selectPreset(preset: PresetRole) {
  form.permissions = [...preset.permissions]
}

function togglePermission(key: string) {
  const idx = form.permissions.indexOf(key)
  if (idx >= 0) {
    form.permissions.splice(idx, 1)
  } else {
    form.permissions.push(key)
  }
}

function getPermissionsForCategory(categoryId: string) {
  return ALL_PERMISSIONS.filter(p => p.category === categoryId)
}

// ── Modal ─────────────────────────────────────────
function openCreateModal() {
  modalMode.value = 'create'
  editingUser.value = null
  form.username = ''
  form.displayName = ''
  form.password = ''
  form.confirmPassword = ''
  form.permissions = []
  formErrors.value = {}
  saveSuccess.value = false
  showModal.value = true
}

function openEditModal(user: UserRow) {
  modalMode.value = 'edit'
  editingUser.value = user
  form.username = user.username
  form.displayName = user.displayName || ''
  form.password = ''
  form.confirmPassword = ''
  form.permissions = [...user.permissions]
  formErrors.value = {}
  saveSuccess.value = false
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  editingUser.value = null
  saveSuccess.value = false
  if (saveSuccessTimer) clearTimeout(saveSuccessTimer)
}

// ── Validation ────────────────────────────────────
function validateForm(): boolean {
  const errors: Record<string, string> = {}

  if (modalMode.value === 'create') {
    if (!form.username.trim()) {
      errors.username = 'Username is required'
    } else if (form.username.length < 3) {
      errors.username = 'Must be at least 3 characters'
    } else if (!/^[a-zA-Z0-9_.-]+$/.test(form.username)) {
      errors.username = 'Letters, numbers, dots, hyphens, underscores only'
    }
    if (!form.password) {
      errors.password = 'Password is required'
    } else if (form.password.length < 6) {
      errors.password = 'At least 6 characters'
    }
    if (form.password !== form.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match'
    }
  } else {
    if (form.password && form.password.length < 6) {
      errors.password = 'At least 6 characters'
    }
    if (form.password && form.password !== form.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match'
    }
  }

  formErrors.value = errors
  return Object.keys(errors).length === 0
}

// ── Submit ────────────────────────────────────────
async function submitForm() {
  if (!validateForm()) return
  submitting.value = true
  try {
    if (modalMode.value === 'create') {
      await request('/api/users/create', {
        method: 'POST',
        body: {
          username: form.username.trim(),
          displayName: form.displayName.trim() || undefined,
          password: form.password,
          permissions: form.permissions,
        },
      })
    } else if (editingUser.value) {
      const body: Record<string, any> = {
        displayName: form.displayName.trim(),
        permissions: form.permissions,
      }
      if (form.password) body.password = form.password
      await request(`/api/users/${editingUser.value.id}`, { method: 'PATCH', body })
    }

    // Show inline success banner, then close after 1.2s
    saveSuccess.value = true
    await fetchUsers()
    if (saveSuccessTimer) clearTimeout(saveSuccessTimer)
    saveSuccessTimer = setTimeout(() => {
      closeModal()
    }, 1200)
  } catch (err: any) {
    toasts.error('Error', err?.data?.statusMessage || 'Failed to save user')
  } finally {
    submitting.value = false
  }
}

// ── Delete ────────────────────────────────────────
function openDeleteConfirm(user: UserRow) {
  deletingUser.value = user
  deleteConfirmName.value = ''
  showDeleteConfirm.value = true
}

async function confirmDelete() {
  if (!deletingUser.value) return
  if (deleteConfirmName.value !== deletingUser.value.username) return
  deleting.value = true
  try {
    await request(`/api/users/${deletingUser.value.id}`, { method: 'DELETE' })
    toasts.success('User deleted', `${deletingUser.value.username} has been removed`)
    showDeleteConfirm.value = false
    deletingUser.value = null
    await fetchUsers()
  } catch (err: any) {
    toasts.error('Error', err?.data?.statusMessage || 'Failed to delete user')
  } finally {
    deleting.value = false
  }
}

async function toggleActive(user: UserRow) {
  try {
    await request(`/api/users/${user.id}`, { method: 'PATCH', body: { isActive: !user.isActive } })
    toasts.success(
      user.isActive ? 'User disabled' : 'User enabled',
      `${user.username} has been ${user.isActive ? 'disabled' : 'enabled'}`
    )
    await fetchUsers()
  } catch (err: any) {
    toasts.error('Error', err?.data?.statusMessage || 'Failed to update user')
  }
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-6">
    <!-- Header -->
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold text-slate-950 dark:text-slate-50">User Management</h1>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Add and manage dashboard users with granular permissions.
        </p>
      </div>
      <UButton size="lg" icon="lucide:user-plus" @click="openCreateModal">
        Add User
      </UButton>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-20">
      <UIcon name="lucide:loader-2" class="h-8 w-8 animate-spin text-brand-500" />
    </div>

    <!-- Empty State -->
    <div v-else-if="users.length === 0" class="sy-dashboard-card flex flex-col items-center justify-center gap-4 py-20">
      <div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 dark:bg-brand-950/40">
        <UIcon name="lucide:users" class="h-8 w-8 text-brand-500" />
      </div>
      <div class="text-center">
        <p class="text-lg font-semibold text-slate-900 dark:text-slate-100">No users yet</p>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Create your first dashboard user to delegate access.</p>
      </div>
      <UButton size="lg" icon="lucide:user-plus" @click="openCreateModal">Add First User</UButton>
    </div>

    <!-- User List -->
    <div v-else class="space-y-3">
      <div v-for="u in users" :key="u.id" class="sy-user-card">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <!-- User Info -->
          <div class="flex items-center gap-3">
            <div
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
              :class="u.isActive
                ? 'bg-brand-100 text-brand-700 dark:bg-brand-950/50 dark:text-brand-400'
                : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600'"
            >
              {{ (u.displayName || u.username).slice(0, 2).toUpperCase() }}
            </div>
            <div>
              <div class="flex flex-wrap items-center gap-2">
                <p class="font-semibold text-slate-900 dark:text-slate-100">{{ u.displayName || u.username }}</p>
                <UBadge :color="getRoleBadgeColor(u.permissions) as any" variant="subtle" size="xs">
                  {{ getRoleLabel(u.permissions) }}
                </UBadge>
                <UBadge v-if="!u.isActive" color="neutral" variant="subtle" size="xs">Disabled</UBadge>
              </div>
              <p class="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                @{{ u.username }} · {{ u.permissions.length }} permission{{ u.permissions.length === 1 ? '' : 's' }} · Added {{ formatDate(u.createdAt) }}
              </p>
            </div>
          </div>
          <!-- Actions -->
          <div class="flex shrink-0 items-center gap-1.5">
            <UButton
              color="neutral" variant="ghost" size="sm"
              :icon="u.isActive ? 'lucide:user-x' : 'lucide:user-check'"
              :title="u.isActive ? 'Disable user' : 'Enable user'"
              @click="toggleActive(u)"
            />
            <UButton color="neutral" variant="ghost" size="sm" icon="lucide:pencil" title="Edit user" @click="openEditModal(u)" />
            <UButton color="error" variant="ghost" size="sm" icon="lucide:trash-2" title="Delete user" @click="openDeleteConfirm(u)" />
          </div>
        </div>

        <!-- Permission chips -->
        <div v-if="u.permissions.length > 0" class="mt-3 flex flex-wrap gap-1.5">
          <span v-for="perm in u.permissions" :key="perm" class="sy-permission-chip">
            {{ ALL_PERMISSIONS.find(p => p.key === perm)?.label || perm }}
          </span>
        </div>
      </div>
    </div>

    <!-- Create / Edit Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition-all duration-200 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition-all duration-150 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="showModal"
          class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 backdrop-blur-sm p-4 pt-[4vh]"
          @click.self="closeModal"
        >
          <div
            class="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700/80 dark:bg-slate-900"
            style="max-height: 92vh; display: flex; flex-direction: column;"
            @click.stop
          >
            <!-- Save success banner -->
            <Transition
              enter-active-class="transition-all duration-300 ease-out"
              enter-from-class="opacity-0 -translate-y-2"
              enter-to-class="opacity-100 translate-y-0"
              leave-active-class="transition-all duration-200 ease-in"
              leave-from-class="opacity-100"
              leave-to-class="opacity-0"
            >
              <div
                v-if="saveSuccess"
                class="absolute inset-x-0 top-0 z-10 flex items-center gap-3 rounded-t-2xl bg-brand-500 px-6 py-3 text-white"
              >
                <UIcon name="lucide:check-circle-2" class="h-5 w-5 shrink-0" />
                <span class="text-sm font-semibold">
                  {{ modalMode === 'create' ? 'User created successfully!' : 'Changes saved successfully!' }}
                </span>
                <span class="ml-auto text-xs opacity-75">Closing…</span>
              </div>
            </Transition>

            <!-- Modal Header -->
            <div
              class="flex shrink-0 items-start justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700/80"
              :class="{ 'pt-14': saveSuccess }"
            >
              <div>
                <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {{ modalMode === 'create' ? 'Add New User' : 'Edit User' }}
                </h2>
                <p class="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                  {{ modalMode === 'create'
                    ? 'Set credentials and assign permissions for the new user.'
                    : `Editing permissions for @${editingUser?.username}` }}
                </p>
              </div>
              <button type="button" class="sy-dashboard-icon-button ml-4 shrink-0" @click="closeModal">
                <UIcon name="lucide:x" class="h-4 w-4" />
              </button>
            </div>

            <!-- Scrollable Body -->
            <form
              class="flex min-h-0 flex-col"
              style="overflow-y: auto; flex: 1;"
              @submit.prevent="submitForm"
            >
              <div class="space-y-6 px-6 py-5">

                <!-- Section: Account Info -->
                <div>
                  <p class="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">Account Info</p>
                  <div class="grid gap-4 sm:grid-cols-2">
                    <UFormField label="Username" :error="formErrors.username">
                      <UInput
                        v-model="form.username"
                        :disabled="modalMode === 'edit'"
                        size="lg"
                        placeholder="e.g. john.doe"
                        autocomplete="off"
                        class="w-full"
                      />
                    </UFormField>
                    <UFormField label="Display Name">
                      <UInput
                        v-model="form.displayName"
                        size="lg"
                        placeholder="e.g. John Doe"
                        class="w-full"
                      />
                    </UFormField>
                  </div>
                </div>

                <!-- Divider -->
                <div class="border-t border-slate-100 dark:border-slate-800" />

                <!-- Section: Password -->
                <div>
                  <p class="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                    {{ modalMode === 'create' ? 'Password' : 'Change Password' }}
                  </p>
                  <div class="grid gap-4 sm:grid-cols-2">
                    <div>
                      <UFormField
                        :label="modalMode === 'create' ? 'Password' : 'New Password'"
                        :error="formErrors.password"
                      >
                        <UInput
                          v-model="form.password"
                          type="password"
                          size="lg"
                          placeholder="Min. 6 characters"
                          autocomplete="new-password"
                          class="w-full"
                        />
                      </UFormField>
                      <p v-if="modalMode === 'edit'" class="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
                        Leave blank to keep current password
                      </p>
                    </div>
                    <UFormField label="Confirm Password" :error="formErrors.confirmPassword">
                      <UInput
                        v-model="form.confirmPassword"
                        type="password"
                        size="lg"
                        placeholder="Re-enter password"
                        autocomplete="new-password"
                        class="w-full"
                      />
                    </UFormField>
                  </div>
                </div>

                <!-- Divider -->
                <div class="border-t border-slate-100 dark:border-slate-800" />

                <!-- Section: Quick Roles -->
                <div>
                  <div class="mb-3 flex items-center justify-between">
                    <p class="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">Quick Roles</p>
                    <span
                      v-if="selectedPreset"
                      class="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-950/50 dark:text-brand-400"
                    >
                      <UIcon name="lucide:check" class="h-3 w-3" />
                      {{ selectedPreset.label }} selected
                    </span>
                    <span
                      v-else-if="form.permissions.length > 0"
                      class="text-xs text-slate-400 dark:text-slate-500"
                    >Custom</span>
                  </div>
                  <div class="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    <button
                      v-for="preset in PRESET_ROLES"
                      :key="preset.id"
                      type="button"
                      class="sy-role-card text-left"
                      :class="{ 'is-selected': selectedPreset?.id === preset.id }"
                      @click="selectPreset(preset)"
                    >
                      <div class="flex items-center gap-2">
                        <UIcon :name="preset.icon" class="h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />
                        <span class="text-sm font-semibold text-slate-900 dark:text-slate-100">{{ preset.label }}</span>
                      </div>
                      <p class="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                        {{ preset.description }}
                      </p>
                    </button>
                  </div>
                </div>

                <!-- Divider -->
                <div class="border-t border-slate-100 dark:border-slate-800" />

                <!-- Section: Individual Permissions -->
                <div>
                  <div class="mb-3 flex items-center justify-between">
                    <p class="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">Permissions</p>
                    <span class="text-xs text-slate-400 dark:text-slate-500">
                      {{ form.permissions.length }} of {{ ALL_PERMISSIONS.length }} selected
                    </span>
                  </div>
                  <div class="space-y-3">
                    <div v-for="category in PERMISSION_CATEGORIES" :key="category.id">
                      <!-- Category header -->
                      <div class="mb-2 flex items-center gap-2">
                        <UIcon :name="category.icon" class="h-3.5 w-3.5 text-slate-400" />
                        <span class="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                          {{ category.label }}
                        </span>
                      </div>
                      <!-- Permission toggles -->
                      <div class="grid gap-2 sm:grid-cols-2">
                        <button
                          v-for="perm in getPermissionsForCategory(category.id)"
                          :key="perm.key"
                          type="button"
                          class="sy-perm-toggle"
                          :class="{ 'is-active': form.permissions.includes(perm.key) }"
                          @click="togglePermission(perm.key)"
                        >
                          <!-- Checkbox -->
                          <div
                            class="flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-all duration-150"
                            :class="form.permissions.includes(perm.key)
                              ? 'border-brand-500 bg-brand-500 text-white'
                              : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800'"
                          >
                            <Transition
                              enter-active-class="transition-all duration-100"
                              enter-from-class="opacity-0 scale-50"
                              enter-to-class="opacity-100 scale-100"
                            >
                              <UIcon
                                v-if="form.permissions.includes(perm.key)"
                                name="lucide:check"
                                class="h-3 w-3"
                              />
                            </Transition>
                          </div>
                          <!-- Label -->
                          <div class="min-w-0 flex-1">
                            <p class="text-sm font-medium leading-tight text-slate-900 dark:text-slate-100">
                              {{ perm.label }}
                            </p>
                            <p class="mt-0.5 text-xs leading-snug text-slate-500 dark:text-slate-400">
                              {{ perm.description }}
                            </p>
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Sticky Footer -->
              <div class="shrink-0 border-t border-slate-200 bg-slate-50/80 px-6 py-4 dark:border-slate-700/80 dark:bg-slate-900/80">
                <div class="flex items-center justify-between gap-3">
                  <p class="text-xs text-slate-400 dark:text-slate-500">
                    <template v-if="form.permissions.length === 0">
                      No permissions assigned — user can log in but won't see any data.
                    </template>
                    <template v-else>
                      {{ form.permissions.length }} permission{{ form.permissions.length === 1 ? '' : 's' }} will be assigned.
                    </template>
                  </p>
                  <div class="flex items-center gap-2.5">
                    <UButton color="neutral" variant="soft" size="lg" @click="closeModal">
                      Cancel
                    </UButton>
                    <UButton type="submit" size="lg" :loading="submitting" :disabled="saveSuccess">
                      {{ modalMode === 'create' ? 'Create User' : 'Save Changes' }}
                    </UButton>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Delete Confirmation Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition-opacity duration-200"
        enter-from-class="opacity-0"
        leave-active-class="transition-opacity duration-150"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="showDeleteConfirm"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          @click.self="showDeleteConfirm = false"
        >
          <div
            class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
            @click.stop
          >
            <div class="flex items-start gap-4">
              <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-50 dark:bg-accent-950/40">
                <UIcon name="lucide:alert-triangle" class="h-5 w-5 text-accent-600 dark:text-accent-400" />
              </div>
              <div>
                <h3 class="font-semibold text-slate-900 dark:text-slate-100">Delete User</h3>
                <p class="mt-0.5 text-sm text-slate-500 dark:text-slate-400">This action is permanent and cannot be undone.</p>
              </div>
            </div>

            <p class="mt-5 text-sm text-slate-600 dark:text-slate-400">
              Type <strong class="font-semibold text-slate-900 dark:text-slate-100">{{ deletingUser?.username }}</strong> to confirm deletion:
            </p>
            <UInput
              v-model="deleteConfirmName"
              class="mt-2.5"
              size="lg"
              placeholder="Enter username to confirm"
            />

            <div class="mt-5 flex items-center justify-end gap-3">
              <UButton color="neutral" variant="soft" size="lg" @click="showDeleteConfirm = false">
                Cancel
              </UButton>
              <UButton
                color="error"
                size="lg"
                :loading="deleting"
                :disabled="deleteConfirmName !== deletingUser?.username"
                @click="confirmDelete"
              >
                Delete User
              </UButton>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
