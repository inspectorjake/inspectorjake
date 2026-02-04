<script setup lang="ts">
/**
 * WorkspaceLayout - Main workspace grid containing preview, inspector, and logs panels.
 * Responsive: stacks vertically by default, uses two-column grid at wider widths.
 */
import type { Selection, ElementSelection } from '@inspector-jake/shared';
import { ComputedStylesMode } from '@inspector-jake/shared';
import type { LogEntry } from '../composables/index.js';
import SelectorBreadcrumb from './SelectorBreadcrumb.vue';
import PreviewPanel from './panels/PreviewPanel.vue';
import InspectorPanel from './panels/InspectorPanel.vue';
import LogsPanel from './panels/LogsPanel.vue';

const props = defineProps<{
  expandedSelection: Selection | null;
  logs: LogEntry[];
  showLogs: boolean;
  computedStylesMode: ComputedStylesMode;
}>();

const emit = defineEmits<{
  'clear-logs': [];
  'close-logs': [];
  'update:computedStylesMode': [mode: ComputedStylesMode];
}>();

/** Type guard for element selections */
function isElement(sel: Selection | null): sel is ElementSelection {
  return sel?.type === 'element';
}
</script>

<template>
  <main class="flex-1 flex flex-col bg-obsidian-900 min-w-0 overflow-hidden">
    <!-- Breadcrumb bar -->
    <SelectorBreadcrumb
      v-if="expandedSelection"
      :selector="isElement(expandedSelection) ? expandedSelection.selector : null"
      :tag-name="isElement(expandedSelection) ? expandedSelection.tagName : null"
    />

    <!-- Main content grid -->
    <div class="flex-1 p-4 grid grid-cols-1 grid-rows-[auto_1fr] gap-4 overflow-hidden min-h-0 lg:grid-cols-[1fr_400px] lg:grid-rows-[1fr]">
      <!-- Left column: Preview -->
      <div class="min-h-[200px] lg:h-full lg:overflow-hidden lg:min-h-0">
        <PreviewPanel
          :image="expandedSelection?.image ?? null"
          :width="expandedSelection?.width ?? 0"
          :height="expandedSelection?.height ?? 0"
        />
      </div>

      <!-- Right column: Inspector + Logs -->
      <div class="flex flex-col gap-3 overflow-hidden min-h-0">
        <InspectorPanel
          v-if="expandedSelection"
          :computed-styles="isElement(expandedSelection) ? expandedSelection.computedStyles : undefined"
          :attributes="isElement(expandedSelection) ? expandedSelection.attributes : undefined"
          :tag-name="isElement(expandedSelection) ? expandedSelection.tagName : undefined"
          :a11y-path="isElement(expandedSelection) ? expandedSelection.a11yPath : undefined"
          :computed-styles-mode="computedStylesMode"
          @update:computed-styles-mode="emit('update:computedStylesMode', $event)"
        />

        <LogsPanel
          :logs="logs"
          :show-logs="showLogs"
          @clear="emit('clear-logs')"
          @close="emit('close-logs')"
        />
      </div>
    </div>
  </main>
</template>
