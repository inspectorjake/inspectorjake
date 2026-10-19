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
  <main class="flex-1 flex flex-col bg-ios-bg min-w-0 overflow-hidden">
    <!-- Large-title header -->
    <SelectorBreadcrumb
      v-if="expandedSelection"
      :selector="isElement(expandedSelection) ? expandedSelection.selector : null"
      :tag-name="isElement(expandedSelection) ? expandedSelection.tagName : null"
      :frame-id="isElement(expandedSelection) ? expandedSelection.frameId : undefined"
    />

    <!-- Main content grid -->
    <div class="flex-1 p-4 grid grid-cols-1 grid-rows-[auto_1fr] gap-4 overflow-hidden min-h-0 lg:grid-cols-[1fr_400px] lg:grid-rows-[1fr]">
      <!-- Left column: Preview -->
      <div class="min-h-[200px] lg:h-full lg:overflow-hidden lg:min-h-0">
        <PreviewPanel
          :image="expandedSelection?.image ?? null"
          :width="expandedSelection?.width ?? 0"
          :height="expandedSelection?.height ?? 0"
          :screenshot-unavailable-reason="isElement(expandedSelection) ? expandedSelection.screenshotUnavailableReason : undefined"
        />
      </div>

      <!-- Right column: Note + Inspector + Logs -->
      <div class="flex flex-col gap-3 overflow-hidden min-h-0">
        <!-- Note editor: iOS grouped text field -->
        <div v-if="expandedSelection" class="shrink-0 flex flex-col gap-1.5">
          <label for="capture-note" class="pl-4 text-[13px] text-ios-label-secondary uppercase tracking-[0.2px]">Jake's notes</label>
          <textarea
            id="capture-note"
            :value="noteText"
            @input="onNoteInput"
            rows="2"
            maxlength="500"
            placeholder="What should change here? e.g. “center this vertically”"
            class="w-full rounded-[14px] bg-ios-elevated px-4 py-3 text-[15px] leading-snug text-ios-label placeholder:text-ios-label-tertiary resize-none focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tint/60"
          />
          <div class="flex justify-between px-4 text-[12px] text-ios-label-secondary">
            <span>Sent to Claude with this capture.</span>
            <span class="tabular-nums">{{ noteText.length }}/500</span>
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
