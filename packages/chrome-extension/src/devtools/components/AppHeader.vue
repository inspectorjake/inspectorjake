<script setup lang="ts">
/**
 * AppHeader - Main header bar for the DevTools panel.
 * Contains picker toggle, logo/title, connection badge, logs toggle, and settings.
 */

import ConnectionBadge from './ConnectionBadge.vue'

defineProps<{
  isConnected: boolean
  sessionName: string | null
  connecting: boolean
  isPicking: boolean
  isCoolingDown: boolean
  showLogs: boolean
  hasLogErrors: boolean
  showSettings: boolean
}>()

const emit = defineEmits<{
  'toggle-picker': []
  'toggle-logs': []
  'toggle-settings': []
}>()
</script>

<template>
  <header class="h-12 border-b border-obsidian-600 bg-obsidian-950 flex items-center justify-between px-4 shrink-0 z-20">
    <!-- Left section -->
    <div class="flex items-center gap-3">
      <!-- Picker button -->
      <button
        class="w-7 h-7 rounded flex items-center justify-center cursor-pointer transition-all"
        :class="[
          isPicking
            ? 'bg-lime-accent text-obsidian-950 shadow-[0_0_10px_rgba(190,242,100,0.3)] animate-pulse'
            : 'bg-obsidian-700 text-gray-400 border border-obsidian-600 hover:text-lime-accent hover:border-lime-accent/50',
          isCoolingDown && 'opacity-40 cursor-not-allowed'
        ]"
        :disabled="isCoolingDown"
        :title="isCoolingDown ? 'Please wait...' : (isPicking ? 'Stop picking (Esc)' : 'Select element or drag region')"
        @click.stop="emit('toggle-picker')"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="10" cy="10" r="7" />
          <path d="m21 21-5.2-5.2" />
          <path d="M10 7v6" />
          <path d="M7 10h6" />
        </svg>
      </button>

      <!-- Logo -->
      <img src="/icons/logo.svg" class="w-6 h-6 rounded" alt="Jake MCP" />

      <!-- Title -->
      <h1 class="text-sm font-bold text-gray-200 tracking-wide uppercase flex items-center">
        Jake MCP
        <span class="text-lime-accent mx-2">//</span>
        Inspector
      </h1>
    </div>

    <!-- Right section -->
    <div class="flex items-center gap-4">
      <!-- Connection Badge -->
      <ConnectionBadge
        :is-connected="isConnected"
        :session-name="sessionName"
        :connecting="connecting"
      />

      <!-- Logs toggle button -->
      <button
        class="p-1 rounded transition-colors"
        :class="[
          showLogs
            ? 'text-lime-accent'
            : 'text-gray-500 hover:text-white hover:bg-obsidian-800',
          hasLogErrors && !showLogs && 'animate-pulse text-red-400'
        ]"
        title="Toggle logs"
        @click="emit('toggle-logs')"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="4 17 10 11 4 5" />
          <line x1="12" y1="19" x2="20" y2="19" />
        </svg>
      </button>

      <!-- Settings gear button -->
      <button
        class="p-1 rounded transition-colors hover:bg-obsidian-800"
        :class="showSettings ? 'text-lime-accent' : 'text-gray-500 hover:text-white'"
        title="Settings"
        @click="emit('toggle-settings')"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>
    </div>
  </header>
</template>
