<script setup lang="ts">
/**
 * CaptureCard - Individual capture item for the sidebar list.
 * Displays element or screenshot selection with thumbnail, name, and metadata.
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
}>()

/** Formatted display name based on selection type */
const displayName = computed(() => {
  if (props.selection.type === 'element') {
    return `#${props.index} <${props.selection.tagName}>`
  }
  return `#${props.index} Screenshot`
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

/** Truncated selector for element selections */
const truncatedSelector = computed(() => {
  if (props.selection.type !== 'element') return null
  return props.selection.selector
})

/** Truncated note preview for the card */
const notePreview = computed(() => {
  const note = props.selection.note
  if (!note) return null
  return note.length > 30 ? note.slice(0, 30) + '...' : note
})
</script>

<template>
  <div
    class="group relative p-3 rounded-md border cursor-pointer transition-all duration-200"
    :class="[
      isActive
        ? 'bg-obsidian-800 border-lime-accent/40 shadow-lg shadow-black/20'
        : 'bg-transparent border-obsidian-700 hover:border-obsidian-500 hover:bg-obsidian-800/50'
    ]"
    @click="emit('select')"
  >
    <!-- Active left bar -->
    <div
      v-if="isActive"
      class="absolute left-0 top-0 bottom-0 w-0.5 bg-lime-accent rounded-l-md shadow-[0_0_8px_rgba(190,242,100,0.5)]"
    ></div>

    <!-- Delete button -->
    <button
      class="absolute top-2 right-2 p-1 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-obsidian-900 rounded"
      title="Remove selection"
      @click.stop="emit('delete')"
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>

    <!-- Name row -->
    <div class="flex justify-between items-start mb-1.5 pl-1 pr-6">
      <span
        class="font-mono text-xs group-hover:text-lime-accent transition-colors"
        :class="[
          isActive ? 'font-bold text-white' : 'font-medium text-gray-300'
        ]"
      >
        {{ displayName }}
      </span>
    </div>

    <!-- Detail row -->
    <div class="flex gap-3 mt-2 pl-1">
      <!-- Thumbnail -->
      <div
        class="w-10 h-10 rounded border flex items-center justify-center shrink-0 overflow-hidden"
        :class="[
          isActive
            ? 'bg-black border-obsidian-600'
            : 'bg-black/40 border-obsidian-600'
        ]"
      >
        <img
          v-if="selection.image"
          :src="selection.image"
          class="w-full h-full object-cover"
          :alt="displayName"
        />
        <span v-else class="text-[9px] text-gray-600 font-mono">IMG</span>
      </div>

      <!-- Info -->
      <div class="flex flex-col justify-center gap-0.5 min-w-0">
        <span
          v-if="selection.type === 'element' && truncatedSelector"
          class="text-[10px] text-gray-300 truncate font-medium"
          :title="truncatedSelector"
        >
          {{ truncatedSelector }}
        </span>
        <span class="text-[10px] text-gray-500 font-mono">
          {{ formattedTime }}
        </span>
      </div>
    </div>

    <!-- Note indicator -->
    <div v-if="notePreview" class="mt-1.5 pl-1 flex items-center gap-1 min-w-0">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 text-gray-600">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
      <span class="text-[9px] text-gray-500 italic truncate" :title="selection.note">{{ notePreview }}</span>
    </div>
  </div>
</template>
