<script setup lang="ts">
type OptionValue = string | number
type SelectOption = { label: string; value: OptionValue }

const props = defineProps<{
  modelValue: OptionValue
  options: SelectOption[]
  placeholder?: string
  id?: string
  wrapperClass?: string
  buttonClass?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: OptionValue): void
}>()

const open = ref(false)
const highlightedIndex = ref(-1)
const containerRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLButtonElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)
const menuStyle = ref<Record<string, string>>({})
const listboxId = computed(() => props.id ? `${props.id}-listbox` : undefined)

const selectedOption = computed(() => {
  return props.options.find((opt) => opt.value === props.modelValue) || null
})

const selectedIndex = computed(() => {
  return props.options.findIndex((opt) => opt.value === props.modelValue)
})

function updateMenuPosition() {
  if (!import.meta.client || !triggerRef.value) {
    return
  }

  const viewportPadding = 8
  const triggerRect = triggerRef.value.getBoundingClientRect()
  const maxHeight = 260
  const spaceBelow = Math.max(0, window.innerHeight - triggerRect.bottom - viewportPadding)
  const spaceAbove = Math.max(0, triggerRect.top - viewportPadding)
  const openAbove = spaceBelow < 180 && spaceAbove > spaceBelow
  const availableHeight = openAbove ? spaceAbove : spaceBelow
  const menuHeight = Math.max(120, Math.min(maxHeight, availableHeight || maxHeight))

  const maxWidth = window.innerWidth - viewportPadding * 2
  const width = Math.min(Math.max(triggerRect.width, 160), maxWidth)

  let left = triggerRect.left
  if (left + width > window.innerWidth - viewportPadding) {
    left = window.innerWidth - viewportPadding - width
  }
  left = Math.max(viewportPadding, left)

  let top = openAbove
    ? triggerRect.top - menuHeight - 6
    : triggerRect.bottom + 6

  top = Math.max(viewportPadding, top)

  menuStyle.value = {
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    maxHeight: `${menuHeight}px`,
  }
}

function closeMenu(restoreFocus = false) {
  open.value = false

  if (restoreFocus && import.meta.client) {
    nextTick(() => {
      triggerRef.value?.focus()
    })
  }
}

function openMenu() {
  open.value = true
  highlightedIndex.value = selectedIndex.value >= 0 ? selectedIndex.value : 0

  if (import.meta.client) {
    nextTick(() => {
      updateMenuPosition()
      menuRef.value?.focus()
    })
  }
}

function toggleMenu() {
  if (open.value) {
    closeMenu()
    return
  }

  openMenu()
}

function selectOption(value: OptionValue) {
  emit('update:modelValue', value)
  closeMenu(true)
}

function highlightNext() {
  if (!props.options.length) {
    return
  }

  highlightedIndex.value = (highlightedIndex.value + 1) % props.options.length
}

function highlightPrevious() {
  if (!props.options.length) {
    return
  }

  highlightedIndex.value = highlightedIndex.value <= 0
    ? props.options.length - 1
    : highlightedIndex.value - 1
}

function selectHighlighted() {
  const option = props.options[highlightedIndex.value]
  if (option) {
    selectOption(option.value)
  }
}

function handleTriggerKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') {
    event.preventDefault()

    if (!open.value) {
      openMenu()
      return
    }

    highlightNext()
    return
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()

    if (!open.value) {
      openMenu()
      return
    }

    highlightPrevious()
    return
  }

  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()

    if (!open.value) {
      openMenu()
      return
    }

    selectHighlighted()
    return
  }

  if (event.key === 'Escape') {
    closeMenu()
  }
}

function handleMenuKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    highlightNext()
    return
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    highlightPrevious()
    return
  }

  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    selectHighlighted()
    return
  }

  if (event.key === 'Escape') {
    event.preventDefault()
    closeMenu(true)
    return
  }

  if (event.key === 'Tab') {
    closeMenu()
  }
}

function handlePointerDown(event: PointerEvent) {
  if (!open.value) {
    return
  }

  const target = event.target as Node | null
  const insideContainer = containerRef.value?.contains(target || null)
  const insideMenu = menuRef.value?.contains(target || null)

  if (!insideContainer && !insideMenu) {
    closeMenu()
  }
}

function handleViewportUpdate() {
  if (open.value) {
    updateMenuPosition()
  }
}

watch(
  () => props.modelValue,
  () => {
    highlightedIndex.value = selectedIndex.value
  },
)

onMounted(() => {
  if (!import.meta.client) {
    return
  }

  window.addEventListener('pointerdown', handlePointerDown)
  window.addEventListener('resize', handleViewportUpdate)
  window.addEventListener('scroll', handleViewportUpdate, true)
})

onBeforeUnmount(() => {
  if (!import.meta.client) {
    return
  }

  window.removeEventListener('pointerdown', handlePointerDown)
  window.removeEventListener('resize', handleViewportUpdate)
  window.removeEventListener('scroll', handleViewportUpdate, true)
})
</script>

<template>
  <div ref="containerRef" class="relative w-full" :class="wrapperClass">
    <button
      :id="id"
      ref="triggerRef"
      type="button"
      class="group relative flex w-full cursor-pointer items-center justify-between text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/20"
      :class="[buttonClass, open ? 'border-brand-500 ring-2 ring-brand-500/20' : '']"
      role="combobox"
      :aria-expanded="open"
      :aria-controls="listboxId"
      aria-haspopup="listbox"
      @click="toggleMenu"
      @keydown="handleTriggerKeydown"
    >
      <div class="flex items-center gap-2 overflow-hidden pr-6">
        <slot name="trigger-icon" />
        <span class="block truncate" :class="!selectedOption ? 'text-slate-400 dark:text-slate-500' : ''">
          {{ selectedOption ? selectedOption.label : (placeholder || 'Select...') }}
        </span>
      </div>
      <span class="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
        <UIcon
          name="lucide:chevron-down"
          class="h-4 w-4 text-slate-400 transition-transform duration-200"
          :class="open ? '-rotate-180 text-brand-500' : 'group-hover:text-brand-500 dark:text-slate-500 dark:group-hover:text-brand-400'"
          aria-hidden="true"
        />
      </span>
    </button>

    <Teleport to="body">
      <transition
        enter-active-class="transition ease-out duration-120"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition ease-in duration-100"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div
          v-if="open"
          :id="listboxId"
          ref="menuRef"
          role="listbox"
          tabindex="-1"
          class="fixed z-[9999] overflow-auto rounded-xl border border-slate-200/80 bg-white/95 py-1 text-sm shadow-xl shadow-brand-900/10 backdrop-blur-xl ring-1 ring-black/5 focus:outline-none dark:border-slate-700/80 dark:bg-slate-800/95 dark:shadow-black/50 dark:ring-white/5"
          :style="menuStyle"
          @keydown="handleMenuKeydown"
        >
          <button
            v-for="(option, index) in options"
            :key="String(option.value)"
            type="button"
            role="option"
            :aria-selected="option.value === modelValue"
            class="relative flex w-full cursor-pointer select-none items-center py-2 pl-3 pr-9 text-left font-medium transition-colors hover:bg-brand-50/70 hover:text-brand-700 focus:outline-none dark:hover:bg-brand-900/20 dark:hover:text-brand-300"
            :class="[
              index === highlightedIndex ? 'bg-brand-50/70 text-brand-700 dark:bg-brand-900/20 dark:text-brand-300' : '',
              option.value === modelValue ? 'text-brand-700 dark:text-brand-300' : 'text-slate-700 dark:text-slate-300'
            ]"
            @mouseenter="highlightedIndex = index"
            @click="selectOption(option.value)"
          >
            <span class="block truncate">{{ option.label }}</span>

            <span
              v-if="option.value === modelValue"
              class="absolute inset-y-0 right-0 flex items-center pr-4 text-brand-600 dark:text-brand-400"
            >
              <UIcon name="lucide:check" class="h-4 w-4" aria-hidden="true" />
            </span>
          </button>
        </div>
      </transition>
    </Teleport>
  </div>
</template>
