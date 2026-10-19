<script setup lang="ts">
/**
 * ConnectionBadge - iOS capsule showing the connected session, with a disconnect button.
 */

defineProps<{
  isConnected: boolean
  sessionName: string | null
  connecting: boolean
}>()

const emit = defineEmits<{
  disconnect: []
}>()
</script>

<template>
  <div class="flex items-center gap-1 mr-1">
    <!-- Connected state -->
    <template v-if="isConnected">
      <span
        class="h-[30px] px-3 rounded-full bg-ios-green/15 text-ios-green text-[13px] font-semibold flex items-center gap-1.5 whitespace-nowrap"
        :title="`Connected to ${sessionName}`"
      >
        <span class="relative flex h-[7px] w-[7px]">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-ios-green opacity-60"></span>
          <span class="relative inline-flex rounded-full h-[7px] w-[7px] bg-ios-green"></span>
        </span>
        <span class="sr-only">Connected to </span>{{ sessionName }}
      </span>
      <button
        class="w-[30px] h-[30px] rounded-full flex items-center justify-center bg-ios-fill text-ios-label-secondary hover:text-ios-red transition-colors"
        title="Disconnect"
        aria-label="Disconnect"
        @click.stop="emit('disconnect')"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
          <path d="M2 2l6 6M8 2l-6 6" />
        </svg>
      </button>
    </template>

    <!-- Connecting state -->
    <span
      v-else-if="connecting"
      class="h-[30px] px-3 rounded-full bg-ios-fill text-ios-label-secondary text-[13px] font-medium flex items-center gap-1.5 whitespace-nowrap"
    >
      <svg class="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
      Connecting…
    </span>

    <!-- Disconnected state -->
    <span
      v-else
      class="h-[30px] px-3 rounded-full bg-ios-fill text-ios-label-secondary text-[13px] font-medium flex items-center gap-1.5 whitespace-nowrap"
    >
      <span class="w-[7px] h-[7px] rounded-full bg-ios-label-tertiary"></span>
      Not connected
    </span>
  </div>
</template>
