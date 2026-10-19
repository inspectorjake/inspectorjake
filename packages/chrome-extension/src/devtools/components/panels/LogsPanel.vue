<script setup lang="ts">
/**
 * LogsPanel - Retro terminal-style system logs display.
 * Shows extension events with level coloring and timestamps.
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
      return { label: 'MCP', colorClass: 'text-ios-purple' };
    }

    switch (entry.level) {
      case LogLevel.DEBUG:
        return { label: 'DEBUG', colorClass: 'text-ios-label-tertiary' };
      case LogLevel.INFO:
        return { label: 'INFO', colorClass: 'text-tint' };
      case LogLevel.WARN:
        return { label: 'WARN', colorClass: 'text-ios-orange' };
      case LogLevel.ERROR:
        return { label: 'ERROR', colorClass: 'text-ios-red' };
      case LogLevel.SUCCESS:
        return { label: 'OK', colorClass: 'text-ios-green' };
      default:
        return { label: 'INFO', colorClass: 'text-ios-label-secondary' };
    }
  };
});

/** Message text color - CMD-level entries get brighter text */
function messageClass(entry: LogEntry): string {
  if (entry.level === LogLevel.ERROR) return 'text-ios-red';
  if (entry.level === LogLevel.WARN) return 'text-ios-orange';
  // CMD-like entries (success from ext) get bright text
  if (entry.level === LogLevel.SUCCESS && entry.source === LogSource.EXT) return 'text-ios-label';
  return 'text-ios-label-secondary';
}
</script>

<template>
  <Transition name="logs-slide">
    <div
      v-if="showLogs"
      class="h-44 rounded-[14px] bg-ios-elevated flex flex-col shrink-0 overflow-hidden"
    >
      <!-- Header bar -->
      <div class="pl-4 pr-1 min-h-[40px] border-b border-ios-separator flex justify-between items-center">
        <div class="flex items-center gap-2">
          <span class="text-[13px] text-ios-label-secondary uppercase tracking-[0.2px]">System Logs</span>
          <span class="text-[11px] font-semibold text-ios-label-secondary bg-ios-fill px-1.5 rounded-full tabular-nums">
            {{ logs.length }}
          </span>
        </div>

        <div class="flex items-center">
          <button
            class="min-h-[36px] px-2.5 text-[15px] text-tint hover:opacity-80"
            title="Clear logs"
            @click="emit('clear')"
          >
            Clear
          </button>
          <button
            class="min-h-[36px] px-2.5 text-[15px] font-semibold text-tint hover:opacity-80"
            title="Close logs"
            @click="emit('close')"
          >
            Done
          </button>
        </div>
      </div>

      <!-- Content area -->
      <div
        ref="logsContent"
        class="flex-1 px-3 py-2 font-mono text-[11px] overflow-y-auto custom-scrollbar"
      >
        <TransitionGroup name="log-entry">
          <div
            v-for="log in logs"
            :key="log.id"
            class="flex gap-2 mb-1 leading-relaxed"
          >
            <!-- Timestamp -->
            <span class="text-ios-label-tertiary shrink-0 tabular-nums">{{ log.time }}</span>

            <!-- Level label -->
            <span
              class="w-10 text-right shrink-0 text-[10px] font-bold uppercase"
              :class="levelConfig(log).colorClass"
            >
              {{ levelConfig(log).label }}
            </span>

            <!-- Message -->
            <span class="truncate" :class="messageClass(log)">{{ log.message }}</span>
          </div>
        </TransitionGroup>

      </div>
    </div>
  </Transition>
</template>
