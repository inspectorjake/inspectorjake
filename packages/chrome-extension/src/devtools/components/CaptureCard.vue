<script setup lang="ts">
/**
 * CaptureCard - One capture as a row in the inset grouped captures list.
 * Thumbnail, tag, selector, note and size; the remove button shows on hover.
 */

import type { Selection } from '@inspector-jake/shared'
import { computed } from 'vue'

const props = defineProps<{
  selection: Selection
  isActive: boolean
  index: number
}>()

const emit = defineEmits<{
  select: []
  delete: []
  'hover-start': []
  'hover-end': []
}>()

/** Formatted display name based on selection type */
const displayName = computed(() => {
  if (props.selection.type === 'element') {
    return `<${props.selection.tagName}>`
  }
  return 'Region'
})

/** Formatted timestamp */
const formattedTime = computed(() => {
  const date = new Date(props.selection.timestamp)
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
})

/** Full selector for element selections */
const fullSelector = computed(() => {
  if (props.selection.type !== 'element') return null
  return props.selection.selector
})

/** Last segment of the selector, the part that names the element */
const truncatedSelector = computed(() => {
  const selector = fullSelector.value
  if (!selector) return null
  return selector.split('>').pop()?.trim() || selector
})

/** Screenshot unavailable reason (element selections only) */
const screenshotUnavailableReason = computed(() => {
  if (props.selection.type !== 'element') return null
  return props.selection.screenshotUnavailableReason ?? null
})

/** Note preview for the row */
const notePreview = computed(() => {
  const note = props.selection.note
  if (!note) return null
  return note.length > 40 ? note.slice(0, 40) + '…' : note
})

/** Check if element is in an iframe */
const isInIframe = computed(() => {
  if (props.selection.type !== 'element') return false
  return props.selection.frameId !== undefined
})

/** Rendered size, e.g. 120×40 */
const sizeLabel = computed(() => {
  const { width, height } = props.selection.rect
  return `${Math.round(width)}×${Math.round(height)}`
})
</script>

<template>
  <div
    role="button"
    tabindex="0"
    :aria-pressed="isActive"
    :aria-label="`Capture ${index}: ${displayName}`"
    class="group relative flex items-center gap-3 pl-4 pr-3 py-2.5 min-h-[60px] cursor-pointer transition-colors
           after:absolute after:left-[68px] after:right-0 after:bottom-0 after:h-px after:bg-ios-separator last:after:hidden"
    :class="isActive ? 'bg-tint/20' : 'hover:bg-white/[0.04]'"
    :title="`#${index} · captured ${formattedTime}`"
    @mouseenter="emit('hover-start')"
    @mouseleave="emit('hover-end')"
    @click="emit('select')"
    @keydown.enter.prevent="emit('select')"
    @keydown.space.prevent="emit('select')"
  >
    <!-- Thumbnail -->
    <div class="w-[40px] h-[40px] rounded-[9px] bg-ios-fill flex items-center justify-center shrink-0 overflow-hidden">
      <img
        v-if="selection.image"
        :src="selection.image"
        class="w-full h-full object-cover"
        :alt="displayName"
      />
      <span
        v-else-if="screenshotUnavailableReason"
        class="text-[9px] text-ios-label-secondary text-center leading-tight px-0.5"
        :title="screenshotUnavailableReason"
      >No preview</span>
      <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" class="text-ios-label-tertiary" aria-hidden="true">
        <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
      </svg>
    </div>

    <!-- Text -->
    <div class="flex-1 min-w-0 flex flex-col gap-px">
      <span class="text-[15px] font-semibold text-ios-label truncate">
        {{ displayName }}
        <span v-if="isInIframe" class="ml-1 align-middle text-[11px] font-semibold text-ios-orange bg-ios-orange/15 px-1.5 py-px rounded-[5px]">iframe</span>
      </span>
      <span
        v-if="truncatedSelector"
        class="text-[12px] font-mono text-ios-label-secondary truncate"
        :title="fullSelector ?? undefined"
      >{{ truncatedSelector }}</span>
      <span v-if="notePreview" class="text-[13px] text-ios-yellow truncate" :title="selection.note">“{{ notePreview }}”</span>
    </div>

    <!-- Size + remove -->
    <span class="text-[12px] text-ios-label-secondary tabular-nums shrink-0 group-hover:hidden group-focus-within:hidden">{{ sizeLabel }}</span>
    <button
      class="hidden group-hover:flex group-focus-within:flex w-[28px] h-[28px] rounded-full items-center justify-center bg-ios-fill text-ios-label-secondary hover:bg-ios-red/20 hover:text-ios-red shrink-0 transition-colors"
      title="Remove selection"
      aria-label="Remove capture"
      @click.stop="emit('delete')"
      @keydown.enter.stop
      @keydown.space.stop
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
    <svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="#5a5a5f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0" aria-hidden="true">
      <path d="m1 1 6 6-6 6" />
    </svg>
  </div>
</template>
