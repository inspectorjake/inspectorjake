<script setup lang="ts">
/**
 * CssPropertiesTab - Displays computed CSS properties in a two-column grid.
 * Shows property names and values with layout-value highlighting.
 */
import { computed } from 'vue';

const props = defineProps<{
  computedStyles: Record<string, string> | undefined;
  mode: string;
}>();

/** Sorted entries from the computed styles record */
const styleEntries = computed(() => {
  if (!props.computedStyles) return [];
  return Object.entries(props.computedStyles).sort(([a], [b]) => a.localeCompare(b));
});

/** Layout-related values that get lime-accent highlighting */
const layoutValues = new Set([
  'flex', 'inline-flex', 'grid', 'inline-grid', 'block', 'inline-block', 'inline',
  'center', 'flex-start', 'flex-end', 'space-between', 'space-around', 'space-evenly',
  'stretch', 'baseline', 'row', 'column', 'row-reverse', 'column-reverse',
  'wrap', 'nowrap', 'wrap-reverse', 'relative', 'absolute', 'fixed', 'sticky',
  'start', 'end', 'left', 'right', 'top', 'bottom',
]);

/** Determine if a CSS value is a layout-related keyword */
function isLayoutValue(value: string): boolean {
  return layoutValues.has(value.trim().toLowerCase());
}

/** Alternating row background */
function rowBg(index: number): string {
  return index % 2 === 0 ? 'bg-obsidian-800/30' : '';
}
</script>

<template>
  <div class="p-0">
    <!-- Empty state -->
    <div
      v-if="!computedStyles || styleEntries.length === 0"
      class="flex flex-col items-center justify-center py-12 px-4 text-center"
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        class="text-gray-600 mb-3"
      >
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
      <span class="text-xs text-gray-500 font-mono">
        No computed styles available
      </span>
      <span class="text-[10px] text-gray-600 mt-1">
        Select an element to view its CSS properties ({{ mode }} mode)
      </span>
    </div>

    <!-- CSS Properties grid -->
    <div v-else class="grid grid-cols-[120px_1fr] text-xs font-mono">
      <template v-for="([key, value], index) in styleEntries" :key="key">
        <!-- Property name -->
        <div
          class="py-2 px-4 border-b border-obsidian-800/50 text-gray-500"
          :class="rowBg(index)"
        >
          {{ key }}
        </div>
        <!-- Property value -->
        <div
          class="py-2 px-4 border-b border-obsidian-800/50 truncate"
          :class="[rowBg(index), isLayoutValue(value) ? 'text-lime-accent' : 'text-gray-300']"
          :title="value"
        >
          {{ value }}
        </div>
      </template>
    </div>
  </div>
</template>
