<script setup lang="ts">
/**
 * AppHeader - Translucent top bar for the DevTools panel.
 * Picker tile and title, the Inspect/Chat segmented control, connection, logs and settings.
 */

import ConnectionBadge from './ConnectionBadge.vue'
import ViewToggleBar, { type ViewMode } from './ViewToggleBar.vue'

defineProps<{
  isConnected: boolean
  sessionName: string | null
  connecting: boolean
  isPicking: boolean
  isCoolingDown: boolean
  showLogs: boolean
  hasLogErrors: boolean
  showSettings: boolean
  view: ViewMode
  chatUnread: number
}>()

const emit = defineEmits<{
  'toggle-picker': []
  'toggle-logs': []
  'toggle-settings': []
  'disconnect': []
  'update:view': [view: ViewMode]
}>()
</script>

<template>
  <header class="ios-material border-b border-ios-separator flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1 min-h-[52px] shrink-0 z-20">
    <!-- Left: picker + title -->
    <div class="flex items-center gap-1 flex-1 basis-[180px] min-w-0">
      <button
        class="w-[44px] h-[44px] flex items-center justify-center shrink-0 rounded-[12px]"
        :class="isCoolingDown && 'opacity-40'"
        :disabled="isCoolingDown"
        :aria-pressed="isPicking"
        :aria-label="isPicking ? 'Stop picking' : 'Pick an element or drag a region'"
        :title="isCoolingDown ? 'Please wait...' : (isPicking ? 'Stop picking (Esc)' : 'Select element or drag region')"
        @click.stop="emit('toggle-picker')"
      >
        <span
          class="w-[30px] h-[30px] rounded-[8px] bg-tint-fill text-on-tint flex items-center justify-center transition-shadow"
          :class="isPicking && 'ring-2 ring-tint/60 ring-offset-2 ring-offset-ios-elevated animate-pulse'"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="10" cy="10" r="7" />
            <path d="m21 21-5.2-5.2" />
            <path d="M10 7v6" />
            <path d="M7 10h6" />
          </svg>
        </span>
      </button>
      <h1 class="text-[17px] font-semibold tracking-[-0.4px] text-ios-label whitespace-nowrap truncate">
        Inspector Jake
      </h1>
    </div>

    <!-- Center: view switch -->
    <ViewToggleBar
      :model-value="view"
      :chat-unread="chatUnread"
      @update:model-value="emit('update:view', $event)"
    />

    <!-- Right: connection, logs, settings -->
    <div class="flex items-center justify-end gap-0.5 flex-1 basis-[180px]">
      <ConnectionBadge
        :is-connected="isConnected"
        :session-name="sessionName"
        :connecting="connecting"
        @disconnect="emit('disconnect')"
      />

      <button
        class="w-[44px] h-[44px] rounded-full flex items-center justify-center transition-colors"
        :class="[
          showLogs ? 'bg-tint/15 text-tint' : 'text-tint hover:bg-white/5',
          hasLogErrors && !showLogs && 'animate-pulse !text-ios-red'
        ]"
        :aria-pressed="showLogs"
        aria-label="Toggle logs"
        title="Toggle logs"
        @click="emit('toggle-logs')"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="16" rx="3" />
          <path d="m7 10 3 2-3 2" />
          <path d="M12 15h5" />
        </svg>
      </button>

      <button
        class="w-[44px] h-[44px] rounded-full flex items-center justify-center transition-colors"
        :class="showSettings ? 'bg-tint/15 text-tint' : 'text-tint hover:bg-white/5'"
        :aria-pressed="showSettings"
        aria-label="Settings"
        title="Settings"
        @click="emit('toggle-settings')"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>
    </div>
  </header>
</template>
