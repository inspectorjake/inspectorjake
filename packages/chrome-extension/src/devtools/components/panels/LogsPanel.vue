<script setup lang="ts">
/**
 * LogsPanel - Retro terminal-style system logs display.
 * Shows extension events with level coloring, timestamps, and a blinking cursor.
 */
import { computed, ref, watch, nextTick } from 'vue';
import type { LogEntry } from '../../composables/index.js';
import { LogLevel, LogSource } from '../../composables/index.js';

const props = defineProps<{
  logs: LogEntry[];
  showLogs: boolean;
}>();

const emit = defineEmits<{
  clear: [];
  close: [];
}>();

const logsContent = ref<HTMLElement | null>(null);

/** Auto-scroll to bottom when new logs arrive */
watch(
  () => props.logs.length,
  async () => {
    await nextTick();
    if (logsContent.value) {
      logsContent.value.scrollTop = logsContent.value.scrollHeight;
    }
  },
);

/** Map log level to display label and color class */
const levelConfig = computed(() => {
  return (entry: LogEntry) => {
    // Source-based overrides
    if (entry.source === LogSource.MCP) {
      return { label: 'MCP', colorClass: 'text-purple-400' };
    }

    switch (entry.level) {
      case LogLevel.DEBUG:
        return { label: 'DEBUG', colorClass: 'text-gray-500' };
      case LogLevel.INFO:
        return { label: 'INFO', colorClass: 'text-lime-accent' };
      case LogLevel.WARN:
        return { label: 'WARN', colorClass: 'text-amber-400' };
      case LogLevel.ERROR:
        return { label: 'ERROR', colorClass: 'text-red-400' };
      case LogLevel.SUCCESS:
        return { label: 'SUCCESS', colorClass: 'text-lime-accent' };
      default:
        return { label: 'INFO', colorClass: 'text-gray-400' };
    }
  };
});

/** Determine the badge background class based on level */
function badgeBgClass(entry: LogEntry): string {
  if (entry.source === LogSource.MCP) return 'bg-purple-400/10';
  switch (entry.level) {
    case LogLevel.DEBUG: return 'bg-gray-500/10';
    case LogLevel.INFO: return 'bg-lime-accent/10';
    case LogLevel.WARN: return 'bg-amber-400/10';
    case LogLevel.ERROR: return 'bg-red-400/10';
    case LogLevel.SUCCESS: return 'bg-lime-accent/10';
    default: return 'bg-gray-400/10';
  }
}

/** Message text color - CMD-level entries get brighter text */
function messageClass(entry: LogEntry): string {
  if (entry.level === LogLevel.ERROR) return 'text-red-300';
  if (entry.level === LogLevel.WARN) return 'text-amber-300';
  // CMD-like entries (success from ext) get bright text
  if (entry.level === LogLevel.SUCCESS && entry.source === LogSource.EXT) return 'text-gray-100';
  return 'text-gray-400';
}
</script>

<template>
  <Transition name="logs-slide">
    <div
      v-if="showLogs"
      class="h-40 border border-obsidian-600 rounded-lg bg-obsidian-700 flex flex-col shrink-0"
    >
      <!-- Header bar -->
      <div class="px-3 py-1.5 border-b border-obsidian-600 flex justify-between items-center bg-obsidian-800">
        <!-- Left: icon + title + count -->
        <div class="flex items-center gap-2">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="text-gray-400"
          >
            <polyline points="4 17 10 11 4 5" />
            <line x1="12" y1="19" x2="20" y2="19" />
          </svg>
          <span class="text-[10px] font-bold text-gray-300 uppercase tracking-wider">System Logs</span>
          <span class="text-[9px] text-gray-500 bg-obsidian-600 px-1.5 py-0.5 rounded font-mono">
            {{ logs.length }}
          </span>
        </div>

        <!-- Right: macOS traffic lights -->
        <div class="flex items-center gap-1.5">
          <button
            class="w-2 h-2 rounded-full bg-red-500/30 hover:bg-red-500 transition-colors cursor-pointer border-0 p-0"
            title="Close logs"
            @click="emit('close')"
          />
          <button
            class="w-2 h-2 rounded-full bg-yellow-500/30 hover:bg-yellow-500 transition-colors cursor-pointer border-0 p-0"
            title="Clear logs"
            @click="emit('clear')"
          />
          <div class="w-2 h-2 rounded-full bg-green-500/30 hover:bg-green-500 transition-colors cursor-pointer" />
        </div>
      </div>

      <!-- Content area -->
      <div
        ref="logsContent"
        class="flex-1 p-2 font-mono text-[10px] overflow-y-auto custom-scrollbar bg-obsidian-900/50"
      >
        <TransitionGroup name="log-entry">
          <div
            v-for="log in logs"
            :key="log.id"
            class="flex gap-2 mb-1 leading-relaxed"
          >
            <!-- Timestamp -->
            <span class="text-gray-600 shrink-0 tabular-nums">{{ log.time }}</span>

            <!-- Level label -->
            <span
              class="w-10 text-right shrink-0 text-[9px] font-bold uppercase"
              :class="levelConfig(log).colorClass"
            >
              {{ levelConfig(log).label }}
            </span>

            <!-- Message -->
            <span class="truncate" :class="messageClass(log)">{{ log.message }}</span>
          </div>
        </TransitionGroup>

        <!-- Blinking cursor at bottom -->
        <div class="flex items-center gap-1 mt-1 opacity-70">
          <span class="text-lime-accent text-[10px]">&#9658;</span>
          <span class="w-2 h-3.5 bg-lime-accent animate-[cursor-blink_1s_step-end_infinite]" />
        </div>
      </div>
    </div>
  </Transition>
</template>
