<script setup lang="ts">
/**
 * SelectorBreadcrumb - Breadcrumb bar showing the element selector path.
 * Displays workspace context and provides a copy-to-clipboard action.
 */

import { ref } from 'vue'

const props = defineProps<{
  selector: string | null
  tagName: string | null
}>()

const copied = ref(false)

async function handleCopy() {
  if (!props.selector) return
  try {
    await navigator.clipboard.writeText(props.selector)
  } catch {
    // Fallback: no-op in restricted contexts
  }
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 1500)
}
</script>

<template>
  <div class="h-10 border-b border-obsidian-700 flex items-center justify-between px-4 bg-obsidian-950/80">
    <!-- Left: breadcrumb path -->
    <div class="flex items-center gap-2 text-xs font-mono overflow-hidden">
      <span class="text-gray-500 shrink-0">Workspace /</span>
      <span class="text-gray-300 font-bold shrink-0">
        {{ selector ? 'Element Inspection' : 'Screenshot' }}
      </span>
      <template v-if="selector">
        <span class="text-lime-accent/60 mx-1">/</span>
        <span class="text-lime-accent truncate" :title="selector">
          {{ selector }}
        </span>
      </template>
    </div>

    <!-- Right: copy button -->
    <div class="flex gap-3">
      <button
        v-if="selector"
        class="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors group"
        :title="copied ? 'Copied!' : 'Copy selector'"
        @click="handleCopy"
      >
        <!-- Copy icon -->
        <svg
          v-if="!copied"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="group-hover:text-lime-accent transition-colors"
        >
          <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
        </svg>
        <!-- Check icon (after copy) -->
        <svg
          v-else
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="text-lime-accent"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <span>{{ copied ? 'Copied' : 'Copy' }}</span>
      </button>
    </div>
  </div>
</template>
