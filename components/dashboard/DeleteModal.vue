<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-200"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="modelValue"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
        @click.self="handleCancel"
      >
        <div
          class="relative w-full max-w-md rounded-2xl bg-white shadow-2xl dark:bg-slate-800"
          @click.stop
        >
          <!-- Header -->
          <div class="flex items-start gap-4 border-b border-slate-200 p-6 dark:border-slate-700">
            <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
              <UIcon name="lucide:alert-triangle" class="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <div class="flex-1">
              <h3 class="text-lg font-semibold text-slate-950 dark:text-white">
                {{ title }}
              </h3>
              <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">
                This action cannot be undone.
              </p>
            </div>
          </div>

          <!-- Body -->
          <div class="p-6">
            <p class="text-sm text-slate-700 dark:text-slate-300">
              {{ description }}
            </p>
          </div>

          <!-- Footer -->
          <div class="flex justify-end gap-3 border-t border-slate-200 p-6 dark:border-slate-700">
            <UButton 
              color="neutral" 
              variant="ghost" 
              @click="handleCancel"
              :disabled="loading"
            >
              Cancel
            </UButton>
            <UButton 
              color="error" 
              @click="handleConfirm" 
              icon="lucide:trash-2"
              :loading="loading"
            >
              {{ confirmLabel || 'Delete' }}
            </UButton>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
const props = defineProps<{
  modelValue: boolean
  title: string
  description: string
  loading?: boolean
  confirmLabel?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'confirm': []
  'cancel': []
}>()

function handleCancel() {
  if (props.loading) return
  emit('update:modelValue', false)
  emit('cancel')
}

function handleConfirm() {
  emit('confirm')
}
</script>
