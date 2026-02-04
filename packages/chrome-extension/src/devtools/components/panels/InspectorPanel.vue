<script setup lang="ts">
/**
 * InspectorPanel - Tabbed inspector with CSS computed properties and Accessibility tabs.
 * Wraps CssPropertiesTab and AccessibilityTab with a tab bar.
 */
import { ref } from 'vue';
import CssPropertiesTab from './CssPropertiesTab.vue';
import AccessibilityTab from './AccessibilityTab.vue';
import { ComputedStylesMode } from '@inspector-jake/shared';

defineProps<{
  computedStyles?: Record<string, string>;
  attributes?: Array<{ name: string; value: string }>;
  tagName?: string;
  a11yPath?: string;
  computedStylesMode: ComputedStylesMode;
}>();

const emit = defineEmits<{
  'update:computedStylesMode': [mode: ComputedStylesMode]
}>();

type Tab = 'CSS' | 'ACCESSIBILITY';
const activeTab = ref<Tab>('CSS');

const STYLE_MODES = [
  { value: ComputedStylesMode.LEAN, label: 'Lean' },
  { value: ComputedStylesMode.NON_DEFAULT, label: 'Non-Default' },
  { value: ComputedStylesMode.ALL, label: 'All' },
];
</script>

<template>
  <div class="flex-1 border border-obsidian-600 rounded-lg bg-obsidian-700 flex flex-col overflow-hidden min-h-0 shadow-xl">
    <!-- Tab bar -->
    <div class="flex items-center justify-between px-4 border-b border-obsidian-600 bg-obsidian-800 h-10 shrink-0">
      <div class="flex items-center gap-6 h-full">
        <button
          class="h-full text-xs font-bold transition-colors border-b-2 px-1 relative top-[1px]"
          :class="activeTab === 'CSS'
            ? 'text-white border-lime-accent'
            : 'text-gray-500 border-transparent hover:text-gray-300'"
          @click="activeTab = 'CSS'"
        >
          CSS
        </button>
        <button
          class="h-full text-xs font-bold transition-colors border-b-2 px-1 relative top-[1px]"
          :class="activeTab === 'ACCESSIBILITY'
            ? 'text-white border-lime-accent'
            : 'text-gray-500 border-transparent hover:text-gray-300'"
          @click="activeTab = 'ACCESSIBILITY'"
        >
          Accessibility
        </button>
      </div>

      <!-- Styles mode toggle (only visible on CSS tab) -->
      <div v-if="activeTab === 'CSS'" class="flex items-center gap-2">
        <span class="text-[9px] text-gray-500 uppercase tracking-wide">Styles:</span>
        <div class="flex border border-obsidian-600 rounded overflow-hidden">
          <button
            v-for="mode in STYLE_MODES"
            :key="mode.value"
            class="px-2 py-0.5 text-[9px] font-medium transition-all border-r border-obsidian-600 last:border-r-0"
            :class="computedStylesMode === mode.value
              ? 'bg-lime-accent text-obsidian-900'
              : 'text-gray-400 hover:text-white hover:bg-obsidian-600'"
            @click="emit('update:computedStylesMode', mode.value)"
          >
            {{ mode.label }}
          </button>
        </div>
      </div>
    </div>

    <!-- Tab content -->
    <div class="flex-1 overflow-auto custom-scrollbar bg-obsidian-900/50 min-h-0">
      <CssPropertiesTab
        v-if="activeTab === 'CSS'"
        :computed-styles="computedStyles"
        :mode="computedStylesMode"
      />
      <AccessibilityTab
        v-else
        :attributes="attributes"
        :tag-name="tagName"
        :a11y-path="a11yPath"
      />
    </div>
  </div>
</template>
