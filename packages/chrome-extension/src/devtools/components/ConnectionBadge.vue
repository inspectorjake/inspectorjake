<script setup lang="ts">
/**
 * ConnectionBadge - Connection status indicator badge.
 * Shows connected/connecting/disconnected state with animated indicators.
 */

defineProps<{
  isConnected: boolean
  sessionName: string | null
  connecting: boolean
}>()
</script>

<template>
  <div class="flex items-center gap-2 px-3 py-1 bg-obsidian-700 rounded border border-obsidian-600 shadow-sm">
    <!-- Connected state -->
    <template v-if="isConnected">
      <span class="relative flex h-2 w-2">
        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-lime-accent opacity-75"></span>
        <span class="relative inline-flex rounded-full h-2 w-2 bg-lime-accent"></span>
      </span>
      <span class="text-xs font-mono text-lime-accent tracking-tight">
        Connected: {{ sessionName }}
      </span>
    </template>

    <!-- Connecting state -->
    <template v-else-if="connecting">
      <svg
        class="animate-spin h-3 w-3 text-gray-400"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
      >
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
      <span class="text-xs font-mono text-gray-400 tracking-tight">Connecting...</span>
    </template>

    <!-- Disconnected state -->
    <template v-else>
      <span class="w-2 h-2 rounded-full bg-gray-500"></span>
      <span class="text-xs font-mono text-gray-500 tracking-tight">Disconnected</span>
    </template>
  </div>
</template>
