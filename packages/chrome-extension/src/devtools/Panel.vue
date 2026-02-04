<script setup lang="ts">
/**
 * Jake MCP DevTools Panel - Slim orchestrator.
 * Composes child components and wires composable state.
 */

import { computed, onMounted, onUnmounted } from 'vue';
import type { ElementInfo } from '@inspector-jake/shared';
import {
  useSelections,
  useConnection,
  usePicker,
  useLogs,
  useSettings,
  LogLevel,
  LogSource,
  type DiscoveredSession,
} from './composables/index.js';

import ViewToggleBar from './components/ViewToggleBar.vue';
import AppHeader from './components/AppHeader.vue';
import CapturesSidebar from './components/CapturesSidebar.vue';
import WorkspaceLayout from './components/WorkspaceLayout.vue';

// ============================================================================
// Composables
// ============================================================================

const {
  selections,
  expandedId,
  expandedSelection,
  toggleExpanded,
  addElementSelection,
  addScreenshotSelection,
  removeSelection,
  clearAllSelections,
  syncSelectionsToBackground,
} = useSelections();

const {
  sessions,
  scanning,
  connecting,
  connectionStatus,
  error: connectionError,
  isConnected,
  connectedSessionName,
  scanForSessions,
  getConnectionStatus,
  connectToSession: connectToSessionBase,
  disconnect,
  handleConnectionClosed,
  stopStatusPolling,
} = useConnection();

const {
  isPicking,
  error: pickerError,
  isCoolingDown,
  startElementPicker,
  stopElementPicker,
  captureElementScreenshot,
  cancelPicking,
} = usePicker();

const { logs, showLogs, addLog, clearLogs, toggleLogs } = useLogs();
const { computedStylesMode } = useSettings();

// ============================================================================
// Computed
// ============================================================================

const error = computed(() => connectionError.value || pickerError.value);
const hasLogErrors = computed(() => logs.value.some(l => l.level === LogLevel.ERROR));

// ============================================================================
// Message Types
// ============================================================================

const MessageType = {
  CONNECTION_CLOSED: 'CONNECTION_CLOSED',
  DEVTOOLS_ELEMENT_SELECTED: 'DEVTOOLS_ELEMENT_SELECTED',
  ELEMENT_PICKED: 'ELEMENT_PICKED',
  SCREENSHOT_REGION_SELECTED: 'SCREENSHOT_REGION_SELECTED',
  PICKER_CANCELLED: 'PICKER_CANCELLED',
  REGION_SELECTED: 'REGION_SELECTED',
  REGION_CANCELLED: 'REGION_CANCELLED',
} as const;

type MessageTypeValue = typeof MessageType[keyof typeof MessageType];

// ============================================================================
// Event Handlers
// ============================================================================

async function handlePickerClick(): Promise<void> {
  if (isCoolingDown.value) return;
  addLog(LogLevel.INFO, LogSource.EXT, `Picker ${isPicking.value ? 'stopping' : 'starting'}`);
  if (isPicking.value) {
    stopElementPicker();
  } else {
    await startElementPicker();
  }
}

async function connectToSession(session: DiscoveredSession): Promise<void> {
  const success = await connectToSessionBase(session);
  if (success) {
    await syncSelectionsToBackground();
  }
}

async function handleMessage(message: { type: string; [key: string]: unknown }): Promise<void> {
  const { type } = message;

  switch (type as MessageTypeValue) {
    case MessageType.CONNECTION_CLOSED:
      handleConnectionClosed();
      break;

    case MessageType.DEVTOOLS_ELEMENT_SELECTED:
      await addElementSelection(message.element as ElementInfo, captureElementScreenshot);
      break;

    case MessageType.ELEMENT_PICKED:
      cancelPicking();
      addLog(LogLevel.SUCCESS, LogSource.EXT, `Element selected: <${(message.element as ElementInfo).tagName}>`);
      await addElementSelection(message.element as ElementInfo, captureElementScreenshot);
      break;

    case MessageType.SCREENSHOT_REGION_SELECTED: {
      cancelPicking();
      const rect = message.rect as { x: number; y: number; width: number; height: number };
      addLog(LogLevel.SUCCESS, LogSource.EXT, `Screenshot region: ${rect.width}×${rect.height}`);
      const image = await captureElementScreenshot(rect);
      if (image) {
        addScreenshotSelection(rect, image);
      }
      break;
    }

    case MessageType.PICKER_CANCELLED:
      addLog(LogLevel.INFO, LogSource.EXT, 'Picker cancelled');
      cancelPicking();
      break;

    case MessageType.REGION_SELECTED: {
      const { image, rect } = message as { image: string; rect: { x: number; y: number; width: number; height: number } };
      if (image) {
        addScreenshotSelection(rect, image);
      }
      break;
    }

    case MessageType.REGION_CANCELLED:
      cancelPicking();
      break;
  }
}

// ============================================================================
// Lifecycle
// ============================================================================

onMounted(async () => {
  chrome.runtime.onMessage.addListener(handleMessage);
  addLog(LogLevel.INFO, LogSource.EXT, 'Inspector Jake initialized');

  await Promise.all([getConnectionStatus(), scanForSessions()]);

  if (!connectionStatus.value.connected && sessions.value.length > 0) {
    const availableSession = sessions.value.find(s => s.status !== 'connected');
    if (availableSession) {
      await connectToSession(availableSession);
    }
  }
});

onUnmounted(() => {
  chrome.runtime.onMessage.removeListener(handleMessage);
  stopStatusPolling();
  if (isPicking.value) {
    stopElementPicker();
  }
});
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden bg-obsidian-900 text-gray-300 font-display antialiased" @click.self="isPicking && stopElementPicker()">
    <!-- View toggle bar -->
    <ViewToggleBar />

    <!-- Header -->
    <AppHeader
      :is-connected="isConnected"
      :session-name="connectedSessionName"
      :connecting="connecting"
      :is-picking="isPicking"
      :is-cooling-down="isCoolingDown"
      :show-logs="showLogs"
      :has-log-errors="hasLogErrors"
      @toggle-picker="handlePickerClick"
      @toggle-logs="toggleLogs"
    />

    <!-- Error banner -->
    <div v-if="error" class="mx-3 mt-2 flex items-center gap-2 px-3 py-2 rounded-md bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="shrink-0">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span>{{ error }}</span>
    </div>

    <!-- Main content area -->
    <div class="flex flex-1 overflow-hidden min-h-0">
      <!-- Sidebar: captures list or session discovery -->
      <CapturesSidebar
        :selections="selections"
        :expanded-id="expandedId"
        :is-connected="isConnected"
        :sessions="sessions"
        :scanning="scanning"
        :connecting="connecting"
        :is-picking="isPicking"
        :is-cooling-down="isCoolingDown"
        @select="toggleExpanded"
        @delete="removeSelection"
        @connect="connectToSession"
        @scan="scanForSessions"
        @pick="handlePickerClick"
        @clear-all="clearAllSelections"
      />

      <!-- Workspace: preview + inspector + logs -->
      <WorkspaceLayout
        v-if="isConnected"
        :expanded-selection="expandedSelection"
        :logs="logs"
        :show-logs="showLogs"
        :computed-styles-mode="computedStylesMode"
        @clear-logs="clearLogs"
        @close-logs="toggleLogs"
        @update:computed-styles-mode="computedStylesMode = $event"
      />
    </div>
  </div>
</template>
