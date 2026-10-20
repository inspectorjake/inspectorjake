<script setup lang="ts">
/**
 * Jake MCP DevTools Panel - Slim orchestrator.
 * Composes child components and wires composable state.
 */

import { computed, ref, watch, onMounted, onUnmounted } from 'vue';
import { ComputedStylesMode } from '@inspector-jake/shared';
import type { ChatBridgeInfo, ChatEntry, ElementInfo, Selection } from '@inspector-jake/shared';
import {
  useSelections,
  useConnection,
  usePicker,
  useLogs,
  useSettings,
  useChat,
  SEND_TO_CLAUDE_TEXT,
  LogLevel,
  LogSource,
  type DiscoveredSession,
} from './composables/index.js';

import type { ViewMode } from './components/ViewToggleBar.vue';
import AppHeader from './components/AppHeader.vue';
import CapturesSidebar from './components/CapturesSidebar.vue';
import WorkspaceLayout from './components/WorkspaceLayout.vue';
import ChatPanel from './components/panels/ChatPanel.vue';
import SettingsPanel from './components/SettingsPanel.vue';

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
  updateSelectionNote,
  refreshExpandedStyles,
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
  highlightSelector,
  clearHighlight,
  captureElementScreenshot,
  cancelPicking,
} = usePicker();

const { logs, showLogs, addLog, clearLogs, toggleLogs } = useLogs();
const {
  computedStylesMode,
  maxScreenshotDimension,
  autoClearSelectionsAfterSeen,
  setComputedStylesMode,
} = useSettings();
const showSettings = ref(false);
let modeUpdateToken = 0;
function toggleSettings() { showSettings.value = !showSettings.value; }

const {
  messages: chatMessages,
  bridgeInfo: chatBridgeInfo,
  sending: chatSending,
  error: chatError,
  unread: chatUnread,
  refresh: refreshChat,
  send: sendChat,
  handleEntry: handleChatEntry,
  handleBridgeInfo: handleChatBridgeInfo,
  markRead: markChatRead,
  reset: resetChat,
} = useChat();
const activeView = ref<ViewMode>('preview');
const chatDraft = ref('');

async function handleChatSend(): Promise<void> {
  if (await sendChat(chatDraft.value, selections.value)) {
    chatDraft.value = '';
  }
}

/** Send to Claude: open the chat and ask Claude to make the changes in the notes, with every capture. */
async function handleSendToClaude(): Promise<void> {
  if (sendBlocker.value) return;
  activeView.value = 'chat';
  await sendChat(SEND_TO_CLAUDE_TEXT, selections.value);
}

// ============================================================================
// Computed
// ============================================================================

const error = computed(() => connectionError.value || pickerError.value);
const hasLogErrors = computed(() => logs.value.some(l => l.level === LogLevel.ERROR));
const noteCount = computed(() => selections.value.filter(s => s.note?.trim()).length);
const sendBlocker = computed(() => {
  if (chatBridgeInfo.value?.available !== true) {
    return chatBridgeInfo.value?.reason ?? 'Chat with Claude is unavailable for this session.';
  }
  if (selections.value.length === 0) return 'Capture an element or region first.';
  return null;
});

// Load the chat for whichever MCP session we're connected to
watch(connectedSessionName, (name) => {
  if (name) {
    refreshChat();
  } else {
    resetChat();
  }
});

watch(activeView, (view) => {
  if (view === 'chat') markChatRead();
});

async function handleComputedStylesModeUpdate(mode: ComputedStylesMode): Promise<void> {
  const token = ++modeUpdateToken;
  await setComputedStylesMode(mode);

  if (token !== modeUpdateToken) {
    return;
  }

  await refreshExpandedStyles();
}

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
  SELECTIONS_AUTO_CLEARED: 'SELECTIONS_AUTO_CLEARED',
  CHAT_ENTRY: 'CHAT_ENTRY',
  CHAT_BRIDGE_INFO: 'CHAT_BRIDGE_INFO',
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

function handlePanelClick(): void {
  if (!isPicking.value) return;
  stopElementPicker();
}

async function connectToSession(session: DiscoveredSession): Promise<void> {
  const success = await connectToSessionBase(session);
  if (success) {
    await syncSelectionsToBackground();
  }
}

async function handleSelectionHoverStart(selection: Selection): Promise<void> {
  if (selection.type !== 'element' || !selection.selector) {
    clearHighlight();
    return;
  }

  await highlightSelector(selection.selector, selection.frameId);
}

function handleSelectionHoverEnd(): void {
  clearHighlight();
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

    case MessageType.SELECTIONS_AUTO_CLEARED:
      clearAllSelections();
      break;

    case MessageType.CHAT_ENTRY:
      handleChatEntry(
        { sessionName: message.sessionName as string | undefined, entry: message.entry as ChatEntry },
        activeView.value === 'chat'
      );
      break;

    case MessageType.CHAT_BRIDGE_INFO:
      handleChatBridgeInfo({ bridgeInfo: (message.bridgeInfo ?? null) as ChatBridgeInfo | null });
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
  clearHighlight();
  if (isPicking.value) {
    stopElementPicker();
  }
});
</script>

<template>
  <div class="relative h-full flex flex-col overflow-hidden bg-ios-bg text-ios-label font-display antialiased" @click="handlePanelClick">
    <!-- Top bar -->
    <AppHeader
      :is-connected="isConnected"
      :session-name="connectedSessionName"
      :connecting="connecting"
      :is-picking="isPicking"
      :is-cooling-down="isCoolingDown"
      :show-logs="showLogs"
      :has-log-errors="hasLogErrors"
      :show-settings="showSettings"
      :view="activeView"
      :chat-unread="chatUnread"
      @toggle-picker="handlePickerClick"
      @toggle-logs="toggleLogs"
      @toggle-settings="toggleSettings"
      @disconnect="disconnect"
      @update:view="activeView = $event"
    />

    <!-- Error banner -->
    <div v-if="error" role="alert" class="mx-3 mt-3 flex items-center gap-2.5 px-4 py-2.5 rounded-[14px] bg-ios-red/15 text-ios-red text-[13px]">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="shrink-0" aria-hidden="true">
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
        :send-blocker="sendBlocker"
        :sending="chatSending"
        @select="toggleExpanded"
        @delete="removeSelection"
        @connect="connectToSession"
        @scan="scanForSessions"
        @pick="handlePickerClick"
        @send-to-claude="handleSendToClaude"
        @clear-all="clearAllSelections"
        @hover-selection-start="handleSelectionHoverStart"
        @hover-selection-end="handleSelectionHoverEnd"
      />

      <!-- Workspace: preview + inspector + logs -->
      <WorkspaceLayout
        v-if="isConnected && activeView === 'preview'"
        :expanded-selection="expandedSelection"
        :logs="logs"
        :show-logs="showLogs"
        :computed-styles-mode="computedStylesMode"
        @clear-logs="clearLogs"
        @close-logs="toggleLogs"
        @update:computed-styles-mode="handleComputedStylesModeUpdate"
        @update:note="updateSelectionNote"
      />

      <!-- Chat with the attached Claude Code session -->
      <ChatPanel
        v-else-if="isConnected"
        v-model:draft="chatDraft"
        :messages="chatMessages"
        :bridge-info="chatBridgeInfo"
        :sending="chatSending"
        :error="chatError"
        :capture-count="selections.length"
        :note-count="noteCount"
        @send="handleChatSend"
      />

      <!-- Not connected -->
      <div v-else class="flex-1 hidden sm:flex items-center justify-center p-8">
        <div class="max-w-[320px] flex flex-col items-center text-center gap-2">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" class="text-ios-label-tertiary mb-1" aria-hidden="true">
            <rect x="3" y="4" width="18" height="16" rx="3" />
            <path d="m7 10 3 2-3 2" />
            <path d="M12 15h5" />
          </svg>
          <p class="text-[17px] font-semibold text-ios-label">Not connected</p>
          <p class="text-[13px] text-ios-label-secondary">Connect to a Claude Code session from the list to start inspecting and chatting.</p>
        </div>
      </div>
    </div>

    <!-- Settings panel (slides from right) -->
    <SettingsPanel
      :open="showSettings"
      @close="toggleSettings"
      @mode-changed="refreshExpandedStyles"
    />
  </div>
</template>
