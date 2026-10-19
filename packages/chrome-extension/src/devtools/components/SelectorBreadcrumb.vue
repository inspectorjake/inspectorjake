<script setup lang="ts">
/**
 * SelectorBreadcrumb - Large-title header for the selected capture: its selector,
 * an iframe badge, and a copy-to-clipboard action.
 */

import { computed, ref } from 'vue'

const props = defineProps<{
  selector: string | null
  tagName: string | null
  frameId?: number
}>()

const copied = ref(false)
const normalizedSelector = computed(() => {
  if (!props.selector) return null
  let normalized = props.selector.trimStart()
  while (normalized.startsWith('/')) {
    normalized = normalized.slice(1).trimStart()
  }
  return normalized.length > 0 ? normalized : null
})

async function handleCopy() {
  if (!normalizedSelector.value) return
  try {
    const textToCopy = props.frameId !== undefined
      ? `[iframe] ${normalizedSelector.value}`
      : normalizedSelector.value
    await navigator.clipboard.writeText(textToCopy)
  } catch (_err) {
    // Fallback: no-op in restricted contexts
  }
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 1500)
}
</script>

<template>
  <div class="flex flex-wrap items-end justify-between gap-x-3 gap-y-2 px-4 pt-4 pb-1">
    <div class="min-w-0 flex flex-col gap-0.5">
      <span class="text-[13px] text-ios-label-secondary uppercase tracking-[0.2px] flex items-center gap-1.5">Workspace<span v-if="frameId !== undefined" class="normal-case text-[11px] font-semibold text-ios-orange bg-ios-orange/15 px-1.5 py-px rounded-[5px]">iframe</span></span>
      <h2
        v-if="normalizedSelector"
        class="text-[22px] font-bold tracking-[-0.4px] text-ios-label font-mono truncate"
        :title="normalizedSelector"
      >{{ normalizedSelector }}</h2>
    </div>

    <button
      v-if="normalizedSelector"
      class="min-h-[34px] px-4 rounded-full bg-tint/15 text-tint text-[15px] font-semibold flex items-center gap-1.5 hover:bg-tint/25 transition-colors shrink-0"
      :title="copied ? 'Copied!' : 'Copy selector'"
      @click="handleCopy"
    >
      <svg v-if="!copied" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
      </svg>
      <svg v-else width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="20 6 9 17 4 12" />
      </svg>
      <span>{{ copied ? 'Copied' : 'Copy Selector' }}</span>
    </button>
  </div>
</template>
