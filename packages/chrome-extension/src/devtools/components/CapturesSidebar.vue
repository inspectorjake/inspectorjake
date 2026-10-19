<script setup lang="ts">
/**
 * CapturesSidebar - Captures as an iOS inset grouped list, or session discovery when disconnected.
 * Adapts between vertical (narrow) and sidebar (wide) layouts.
 */
import type { Selection } from '@inspector-jake/shared';
import type { DiscoveredSession } from '../composables/index.js';
import CaptureCard from './CaptureCard.vue';

defineProps<{
  selections: Selection[];
  expandedId: string | null;
  isConnected: boolean;
  sessions: DiscoveredSession[];
  scanning: boolean;
  connecting: boolean;
  isPicking: boolean;
  isCoolingDown: boolean;
}>();

const emit = defineEmits<{
  'select': [id: string];
  'delete': [id: string];
  'hover-selection-start': [selection: Selection];
  'hover-selection-end': [];
  'connect': [session: DiscoveredSession];
  'scan': [];
  'pick': [];
  'clear-all': [];
}>();
</script>

<template>
  <aside class="bg-ios-bg flex flex-col shrink-0 w-full sm:w-80 min-h-0">
    <div class="flex-1 overflow-y-auto custom-scrollbar px-3 pt-3 pb-4 flex flex-col gap-2">
      <!-- Section header -->
      <div class="flex justify-between items-center pl-4 pr-1 min-h-[32px]">
        <h2 class="text-[13px] font-normal text-ios-label-secondary uppercase tracking-[0.2px]">
          {{ isConnected ? `Captures · ${selections.length}` : 'Sessions' }}
        </h2>
        <!-- Clear all (connected with selections) -->
        <button
          v-if="isConnected && selections.length > 0"
          class="min-h-[32px] px-2 text-[15px] text-tint hover:opacity-80"
          title="Clear all selections"
          @click="emit('clear-all')"
        >
          Clear
        </button>
        <!-- Rescan (disconnected) -->
        <button
          v-if="!isConnected"
          class="min-h-[32px] px-2 text-[15px] text-tint hover:opacity-80 flex items-center gap-1.5 disabled:opacity-50"
          title="Scan for MCP servers"
          :disabled="scanning"
          @click="emit('scan')"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :class="{ 'animate-spin': scanning }" aria-hidden="true">
            <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
            <path d="M21 3v5h-5" />
          </svg>
          {{ scanning ? 'Scanning…' : 'Scan' }}
        </button>
      </div>

      <!-- Connected: captures -->
      <template v-if="isConnected">
        <div v-if="selections.length > 0" class="rounded-[14px] bg-ios-elevated overflow-hidden">
          <CaptureCard
            v-for="(sel, i) in selections"
            :key="sel.id"
            :selection="sel"
            :is-active="expandedId === sel.id"
            :index="i + 1"
            @select="emit('select', sel.id)"
            @delete="emit('delete', sel.id)"
            @hover-start="emit('hover-selection-start', sel)"
            @hover-end="emit('hover-selection-end')"
          />
        </div>

        <!-- Empty state -->
        <div
          v-else-if="!isPicking"
          class="rounded-[14px] bg-ios-elevated px-4 py-6 flex flex-col items-center text-center gap-1.5"
        >
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-ios-label-tertiary mb-1" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
            <path d="M11 8v6" />
            <path d="M8 11h6" />
          </svg>
          <p class="text-[15px] font-semibold text-ios-label">No captures yet</p>
          <p class="text-[13px] text-ios-label-secondary">Pick an element, or drag a region to capture it.</p>
        </div>

        <!-- Pick -->
        <button
          class="mt-1 min-h-[50px] rounded-[14px] text-[17px] font-semibold flex items-center justify-center gap-2 transition-opacity"
          :class="[
            isPicking ? 'bg-tint/20 text-tint animate-pulse' : 'bg-tint-fill text-on-tint hover:opacity-90',
            isCoolingDown && 'opacity-40 pointer-events-none',
          ]"
          :disabled="isCoolingDown"
          @click.stop="emit('pick')"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="m4 4 7 17 2.5-7.5L21 11z" />
          </svg>
          {{ isPicking ? 'Click an element…' : 'Pick Element' }}
        </button>
        <p class="px-4 text-[13px] text-ios-label-secondary">
          <template v-if="isPicking">Scroll ↑↓ for parent or child · Drag to capture a region · Esc to cancel</template>
          <template v-else>Notes on your captures go to Claude with every chat message.</template>
        </p>
      </template>

      <!-- Disconnected: sessions -->
      <template v-else>
        <!-- Scanning -->
        <div v-if="scanning" class="rounded-[14px] bg-ios-elevated flex items-center gap-3 px-4 min-h-[56px]">
          <svg class="animate-spin text-ios-label-secondary" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          <span class="text-[15px] text-ios-label-secondary">Scanning for servers…</span>
        </div>

        <!-- No sessions -->
        <div v-else-if="sessions.length === 0" class="rounded-[14px] bg-ios-elevated px-4 py-4 flex flex-col gap-2">
          <p class="text-[15px] font-semibold text-ios-label">No MCP servers found</p>
          <p class="text-[13px] text-ios-label-secondary">Add the server to Claude Code, then start a session:</p>
          <code class="block px-3 py-2 rounded-[10px] bg-ios-bg text-[12px] font-mono text-ios-label overflow-x-auto whitespace-nowrap custom-scrollbar">
            claude mcp add inspector-jake -- npx -y inspector-jake-mcp
          </code>
        </div>

        <!-- Session list -->
        <ul v-else class="rounded-[14px] bg-ios-elevated overflow-hidden">
          <li
            v-for="session in sessions"
            :key="session.name"
            class="relative flex items-center gap-3 px-4 min-h-[60px] after:absolute after:left-[64px] after:right-0 after:bottom-0 after:h-px after:bg-ios-separator last:after:hidden"
          >
            <span
              class="w-[36px] h-[36px] rounded-[9px] flex items-center justify-center shrink-0 text-white"
              :class="session.status === 'connected' ? 'bg-ios-fill-strong' : 'bg-ios-segment'"
              aria-hidden="true"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="4" width="18" height="16" rx="3" />
                <path d="m7 10 3 2-3 2" />
                <path d="M12 15h5" />
              </svg>
            </span>
            <span class="flex-1 min-w-0 flex flex-col">
              <span class="text-[17px] text-ios-label truncate" :title="session.name">{{ session.name }}</span>
              <span class="text-[13px] text-ios-label-secondary">Port {{ session.port }}</span>
            </span>
            <span v-if="session.status === 'connected'" class="text-[15px] text-ios-label-secondary">In Use</span>
            <button
              v-else
              class="min-h-[32px] px-4 rounded-full bg-tint/15 text-tint text-[15px] font-semibold hover:bg-tint/25 disabled:opacity-50"
              :disabled="connecting"
              @click.stop="emit('connect', session)"
            >
              Connect
            </button>
          </li>
        </ul>
        <p v-if="sessions.length > 0" class="px-4 text-[13px] text-ios-label-secondary">
          “In Use” sessions are attached to another tab.
        </p>
      </template>
    </div>
  </aside>
</template>
