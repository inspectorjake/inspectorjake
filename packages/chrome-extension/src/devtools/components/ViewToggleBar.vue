<script lang="ts">
export type ViewMode = 'preview' | 'chat'
</script>

<script setup lang="ts">
/**
 * ViewToggleBar - iOS segmented control switching between the Inspect and Chat views.
 */
defineProps<{
  modelValue: ViewMode
  /** Replies that arrived while the chat view was closed */
  chatUnread?: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: ViewMode]
}>()
</script>

<template>
  <div role="tablist" aria-label="View" class="flex p-[2px] rounded-[9px] bg-[rgba(118,118,128,0.24)] shrink-0">
    <button
      role="tab"
      :aria-selected="modelValue === 'preview'"
      class="min-w-[88px] h-[32px] px-4 rounded-[7px] text-[13px] text-ios-label transition-colors"
      :class="modelValue === 'preview'
        ? 'bg-ios-segment font-semibold shadow-[0_3px_8px_rgba(0,0,0,0.12)]'
        : 'font-medium hover:bg-white/5'"
      data-testid="view-preview"
      @click="emit('update:modelValue', 'preview')"
    >
      Inspect
    </button>
    <button
      role="tab"
      :aria-selected="modelValue === 'chat'"
      class="min-w-[88px] h-[32px] px-4 rounded-[7px] text-[13px] text-ios-label transition-colors flex items-center justify-center gap-1.5"
      :class="modelValue === 'chat'
        ? 'bg-ios-segment font-semibold shadow-[0_3px_8px_rgba(0,0,0,0.12)]'
        : 'font-medium hover:bg-white/5'"
      data-testid="view-chat"
      @click="emit('update:modelValue', 'chat')"
    >
      Chat
      <span
        v-if="modelValue !== 'chat' && chatUnread"
        class="min-w-[18px] h-[18px] px-[5px] rounded-full bg-ios-red text-white text-[11px] font-bold leading-[18px] text-center"
        :aria-label="`${chatUnread} unread`"
        data-testid="chat-unread"
      >
        {{ chatUnread }}
      </span>
    </button>
  </div>
</template>
