<script setup lang="ts">
/**
 * InspectorPanel - Inspector card with a CSS / Accessibility segmented control.
 * Wraps CssPropertiesTab and AccessibilityTab.
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

const TABS: Array<{ value: Tab; label: string }> = [
  { value: 'CSS', label: 'CSS' },
  { value: 'ACCESSIBILITY', label: 'Accessibility' },
];

const STYLE_MODES = [
  { value: ComputedStylesMode.NONE, label: 'None' },
  { value: ComputedStylesMode.LEAN, label: 'Lean' },
  { value: ComputedStylesMode.NON_DEFAULT, label: 'Non-Default' },
  { value: ComputedStylesMode.ALL, label: 'All' },
];
</script>

<template>
  <div class="flex-1 rounded-[14px] bg-ios-elevated flex flex-col overflow-hidden min-h-[240px]">
    <div class="p-3 flex flex-col gap-2 shrink-0 border-b border-ios-separator">
      <!-- View switch -->
      <div role="tablist" aria-label="Inspector view" class="flex p-[2px] rounded-[9px] bg-[rgba(118,118,128,0.24)]">
        <button
          v-for="tab in TABS"
          :key="tab.value"
          role="tab"
          :aria-selected="activeTab === tab.value"
          class="flex-1 h-[30px] rounded-[7px] text-[13px] text-ios-label transition-colors"
          :class="activeTab === tab.value
            ? 'bg-ios-segment font-semibold shadow-[0_3px_8px_rgba(0,0,0,0.12)]'
            : 'font-medium hover:bg-white/5'"
          @click="activeTab = tab.value"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- Styles mode (CSS view only) -->
      <div v-if="activeTab === 'CSS'" class="flex items-center gap-2">
        <span class="text-[12px] text-ios-label-secondary whitespace-nowrap">Send Styles:</span>
        <div class="flex-1 flex p-[2px] rounded-[8px] bg-[rgba(118,118,128,0.24)]">
          <button
            v-for="mode in STYLE_MODES"
            :key="mode.value"
            class="flex-1 h-[24px] px-1.5 rounded-[6px] text-[12px] text-ios-label whitespace-nowrap transition-colors"
            :class="computedStylesMode === mode.value
              ? 'bg-ios-segment font-semibold'
              : 'font-medium text-ios-label-secondary hover:text-ios-label'"
            :aria-pressed="computedStylesMode === mode.value"
            @click="emit('update:computedStylesMode', mode.value)"
          >
            {{ mode.label }}
          </button>
        </div>
      </div>
    </div>

    <!-- Tab content -->
    <div class="flex-1 overflow-auto custom-scrollbar min-h-0">
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
