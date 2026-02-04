<script setup lang="ts">
/**
 * CapturesSidebar - Captures list with session discovery and add-capture button.
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
  'connect': [session: DiscoveredSession];
  'scan': [];
  'pick': [];
  'clear-all': [];
}>();
</script>

<template>
  <aside class="border-r border-obsidian-600 bg-obsidian-700 flex flex-col shrink-0 w-full sm:w-80">
    <!-- Header -->
    <div class="p-3 border-b border-obsidian-600 flex justify-between items-center bg-obsidian-700">
      <span class="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
        {{ isConnected ? 'Active Captures' : 'Connections' }}
      </span>
      <div class="flex items-center gap-2">
        <!-- Clear all button (only when connected with selections) -->
        <button
          v-if="isConnected && selections.length > 0"
          class="p-1 text-gray-500 hover:text-red-400 transition-colors rounded hover:bg-obsidian-600"
          title="Clear all selections"
          @click="emit('clear-all')"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h18" />
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
          </svg>
        </button>
        <!-- Scan button (only when not connected) -->
        <button
          v-if="!isConnected"
          class="p-1 text-gray-500 hover:text-lime-accent transition-colors rounded hover:bg-obsidian-600"
          :class="{ 'animate-spin': scanning }"
          title="Scan for MCP servers"
          :disabled="scanning"
          @click="emit('scan')"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
            <path d="M16 16h5v5" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
      <!-- Connected: Show captures list -->
      <template v-if="isConnected">
        <CaptureCard
          v-for="(sel, i) in selections"
          :key="sel.id"
          :selection="sel"
          :is-active="expandedId === sel.id"
          :index="i + 1"
          @select="emit('select', sel.id)"
          @delete="emit('delete', sel.id)"
        />

        <!-- Add New Capture button -->
        <div
          class="mt-4 p-6 rounded-lg border-2 border-dashed border-obsidian-600 bg-obsidian-800/20 hover:bg-obsidian-800/50 hover:border-lime-accent/30 transition-all cursor-pointer group flex flex-col items-center justify-center gap-2"
          :class="{
            '!border-lime-accent !border-solid bg-lime-accent/10 animate-pulse': isPicking,
            'opacity-40 cursor-not-allowed pointer-events-none': isCoolingDown,
          }"
          @click="emit('pick')"
        >
          <div class="flex items-center gap-2">
            <div class="w-6 h-6 rounded-full bg-lime-accent/10 flex items-center justify-center group-hover:bg-lime-accent/20 transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-lime-accent">
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </svg>
            </div>
            <span class="text-xs font-bold text-gray-400 group-hover:text-white uppercase tracking-tighter transition-colors">
              {{ isPicking ? 'Click element...' : 'Add New Capture' }}
            </span>
          </div>
          <span v-if="!isPicking" class="text-[9px] font-mono text-lime-accent/60 bg-lime-accent/5 px-2 py-0.5 rounded border border-lime-accent/10">
            PICK ELEMENT
          </span>
          <span v-else class="text-[9px] font-mono text-gray-400">
            Press Esc to cancel
          </span>
        </div>

        <!-- Empty state for captures -->
        <div
          v-if="selections.length === 0 && !isPicking"
          class="mt-2 text-center py-6"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-gray-600 mx-auto mb-2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
            <path d="M11 8v6" />
            <path d="M8 11h6" />
          </svg>
          <p class="text-xs text-gray-500">No captures yet</p>
          <p class="text-[10px] text-gray-600 mt-1">Click + above or use the picker</p>
        </div>
      </template>

      <!-- Disconnected: Show sessions list -->
      <template v-else>
        <!-- Scanning state -->
        <div v-if="scanning" class="flex items-center gap-3 p-4 justify-center">
          <svg class="animate-spin text-lime-accent" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          <span class="text-xs text-gray-400">Scanning for servers...</span>
        </div>

        <!-- No sessions -->
        <div v-else-if="sessions.length === 0" class="text-center py-6 px-4">
          <p class="text-xs text-gray-400">No MCP servers found.</p>
          <p class="text-[10px] text-gray-500 mt-2">Start one with:</p>
          <code class="block mt-2 px-3 py-2 bg-obsidian-800 rounded text-xs font-mono text-lime-accent">
            npx vibe-jake-mcp
          </code>
        </div>

        <!-- Session list -->
        <template v-else>
          <div
            v-for="session in sessions"
            :key="session.name"
            class="p-3 rounded-md border border-obsidian-600 bg-obsidian-800/50 flex items-center justify-between cursor-pointer transition-all hover:border-obsidian-500 hover:bg-obsidian-800"
            :class="{ 'opacity-60 cursor-not-allowed': connecting || session.status === 'connected' }"
            @click="!(connecting || session.status === 'connected') && emit('connect', session)"
          >
            <div class="flex flex-col gap-0.5">
              <div class="flex items-center gap-2">
                <svg width="8" height="8" viewBox="0 0 8 8">
                  <circle cx="4" cy="4" r="4" :fill="session.status === 'connected' ? '#F59E0B' : '#22C55E'" />
                </svg>
                <span class="text-xs font-medium text-gray-200">{{ session.name }}</span>
              </div>
              <span class="text-[10px] text-gray-500 ml-4 font-mono">Port {{ session.port }}</span>
            </div>
            <button
              class="px-3 py-1 rounded text-[10px] font-bold uppercase transition-all"
              :class="session.status === 'connected'
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                : 'bg-lime-accent text-obsidian-900 hover:bg-lime-accent/90'"
              :disabled="connecting || session.status === 'connected'"
              @click.stop="emit('connect', session)"
            >
              {{ session.status === 'connected' ? 'In Use' : 'Connect' }}
            </button>
          </div>
        </template>
      </template>
    </div>
  </aside>
</template>
