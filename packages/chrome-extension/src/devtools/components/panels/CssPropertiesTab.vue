<script setup lang="ts">
/**
 * CssPropertiesTab - Computed CSS properties as Settings-style rows.
 * Layout keywords are highlighted in the accent color.
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

/** Layout-related values that get accent highlighting */
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

/** A color value that can be shown as a swatch */
function swatchColor(value: string): string | null {
  const v = value.trim();
  return /^(#[0-9a-f]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\))$/i.test(v) ? v : null;
}
</script>

<template>
  <div>
    <!-- Empty state -->
    <div
      v-if="!computedStyles || styleEntries.length === 0"
      class="flex flex-col items-center justify-center py-12 px-4 text-center gap-1.5"
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" class="text-ios-label-tertiary mb-1" aria-hidden="true">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
      <span class="text-[15px] font-semibold text-ios-label">No computed styles</span>
      <span class="text-[13px] text-ios-label-secondary">
        Select an element to see its CSS ({{ mode }} mode).
      </span>
    </div>

    <!-- CSS properties -->
    <dl v-else class="m-0">
      <div
        v-for="[key, value] in styleEntries"
        :key="key"
        class="relative flex items-center justify-between gap-3 pl-4 pr-3 min-h-[36px] after:absolute after:left-4 after:right-0 after:bottom-0 after:h-px after:bg-ios-separator last:after:hidden"
      >
        <dt class="text-[13px] text-ios-label shrink-0">{{ key }}</dt>
        <dd
          class="m-0 flex items-center gap-1.5 min-w-0 text-[12px] font-mono text-right"
          :class="isLayoutValue(value) ? 'text-tint' : 'text-ios-label-secondary'"
          :title="value"
        >
          <span
            v-if="swatchColor(value)"
            class="w-[13px] h-[13px] rounded-[4px] shrink-0 shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.3)]"
            :style="{ background: swatchColor(value) ?? undefined }"
            aria-hidden="true"
          />
          <span class="truncate">{{ value }}</span>
        </dd>
      </div>
    </dl>
  </div>
</template>
