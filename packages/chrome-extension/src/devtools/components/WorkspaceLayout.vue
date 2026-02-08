<script setup lang="ts">
/**
 * WorkspaceLayout - Main workspace grid containing preview, inspector, and logs panels.
 * Responsive: stacks vertically by default, uses two-column grid at wider widths.
 */
import { ref, watch } from 'vue';
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
  'update:note': [id: string, note: string];
}>();

/** Type guard for element selections */
function isElement(sel: Selection | null): sel is ElementSelection {
  return sel?.type === 'element';
}

// Note editing state
const noteText = ref('');
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

// Sync noteText when the expanded selection changes
watch(
  () => props.expandedSelection,
  (sel) => {
    noteText.value = sel?.note ?? '';
  },
  { immediate: true }
);

function onNoteInput(event: Event) {
  const value = (event.target as HTMLTextAreaElement).value;
  if (value.length > 500) return;
  noteText.value = value;

  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (props.expandedSelection) {
      emit('update:note', props.expandedSelection.id, noteText.value);
    }
  }, 300);
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

      <!-- Right column: Note + Inspector + Logs -->
      <div class="flex flex-col gap-3 overflow-hidden min-h-0">
        <!-- Note editor -->
        <div v-if="expandedSelection" class="shrink-0">
          <div class="relative">
            <textarea
              :value="noteText"
              @input="onNoteInput"
              rows="2"
              maxlength="500"
              placeholder="Add a note for the LLM... e.g. 'I want this vertically centered'"
              class="w-full bg-obsidian-800 border border-obsidian-600 rounded-md px-3 py-2 text-xs text-gray-300 font-mono placeholder:text-gray-600 resize-none focus:outline-none focus:border-lime-accent/40 transition-colors"
            />
            <span class="absolute bottom-1.5 right-2 text-[9px] text-gray-600 font-mono">{{ noteText.length }}/500</span>
          </div>
        </div>

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
