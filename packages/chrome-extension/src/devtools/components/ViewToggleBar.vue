<script setup lang="ts">
/**
 * ViewToggleBar - Top bar with Preview/Code view toggle and utility icons.
 * Preview is the active view; Code is a placeholder stub.
 */
import { ref } from 'vue'

type ViewMode = 'preview' | 'code'
const activeView = ref<ViewMode>('preview')
</script>

<template>
  <div class="h-8 border-b border-obsidian-700 bg-obsidian-950 flex items-center justify-between px-4 shrink-0">
    <!-- Left: View toggle -->
    <div class="flex items-center gap-1">
      <button
        class="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors"
        :class="activeView === 'preview'
          ? 'text-white bg-obsidian-800'
          : 'text-gray-500 hover:text-gray-300'"
        @click="activeView = 'preview'"
      >
        <span
          v-if="activeView === 'preview'"
          class="w-1.5 h-1.5 rounded-full bg-lime-accent"
        />
        Preview
      </button>
      <button
        class="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors"
        :class="activeView === 'code'
          ? 'text-white bg-obsidian-800'
          : 'text-gray-500 hover:text-gray-300'"
        @click="activeView = 'code'"
      >
        Code
      </button>
    </div>

    <!-- Right: Utility icons -->
    <div class="flex items-center gap-2">
      <!-- Monitor icon -->
      <button class="p-1 text-gray-500 hover:text-white transition-colors rounded hover:bg-obsidian-800" title="Preview mode">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect width="20" height="14" x="2" y="3" rx="2" />
          <line x1="8" x2="16" y1="21" y2="21" />
          <line x1="12" x2="12" y1="17" y2="21" />
        </svg>
      </button>
      <!-- Code brackets icon -->
      <button class="p-1 text-gray-500 hover:text-white transition-colors rounded hover:bg-obsidian-800" title="Code view">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      </button>
      <!-- Fullscreen icon -->
      <button class="p-1 text-gray-500 hover:text-white transition-colors rounded hover:bg-obsidian-800" title="Fullscreen">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 3H5a2 2 0 0 0-2 2v3" />
          <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
          <path d="M3 16v3a2 2 0 0 0 2 2h3" />
          <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
        </svg>
      </button>
    </div>
  </div>
</template>
