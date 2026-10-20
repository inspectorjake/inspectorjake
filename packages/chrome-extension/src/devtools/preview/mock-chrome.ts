// Chrome API mock for standalone preview mode.
// Installs a comprehensive window.chrome mock before Panel.vue mounts.

import {
  MOCK_SESSIONS,
  MOCK_CHAT_BRIDGE,
  MOCK_CHAT_HISTORY,
  MOCK_CHAT_REPLIES,
  generateMockScreenshot,
} from './mock-data';

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

export const mockState = {
  connected: false,
  sessionName: null as string | null,
  pickerActive: false,
};

const messageListeners: Array<(message: any) => void> = [];
const storage = new Map<string, unknown>();

const mockChat = {
  bridgeInfo: { ...MOCK_CHAT_BRIDGE } as { available: boolean; name?: string; parentName?: string; reason?: string },
  history: MOCK_CHAT_HISTORY.map((entry) => ({ ...entry })) as Array<Record<string, unknown>>,
  replyIndex: 0,
  /** Captures the panel last synced, attached to each sent message like the real background */
  captureCount: 0,
};

// ---------------------------------------------------------------------------
// Public helpers (used by StateController)
// ---------------------------------------------------------------------------

/** Dispatch a message to all registered onMessage listeners. */
export function dispatchMessage(message: Record<string, unknown>): void {
  for (const listener of messageListeners) {
    listener(message);
  }
}

/** Add or replace a chat entry and broadcast it, as the background does. */
function upsertChatEntry(entry: Record<string, unknown>): void {
  const index = mockChat.history.findIndex((e) => e.id === entry.id);
  if (index === -1) mockChat.history.push(entry);
  else mockChat.history[index] = entry;
  dispatchMessage({ type: 'CHAT_ENTRY', sessionName: mockState.sessionName, entry });
}

/** Simulate a reply from the attached Claude Code session. */
export function simulateChatReply(text?: string): void {
  upsertChatEntry({
    id: `mock-reply-${Date.now()}`,
    role: 'claude',
    text: text ?? MOCK_CHAT_REPLIES[mockChat.replyIndex++ % MOCK_CHAT_REPLIES.length],
    ts: Date.now(),
    fromName: MOCK_CHAT_BRIDGE.parentName,
  });
}

/** Simulate a delivery notice, e.g. a message held for approval. */
export function simulateChatHeld(): void {
  upsertChatEntry({
    id: `mock-status-${Date.now()}`,
    role: 'system',
    text: 'Held for approval in the Claude Code terminal.',
    ts: Date.now(),
  });
}

/** Toggle whether the MCP server reports chat as available. */
export function toggleChatAvailable(): void {
  mockChat.bridgeInfo = mockChat.bridgeInfo.available
    ? { available: false, reason: 'This MCP server was not started by a Claude Code session with cross-session messaging.' }
    : { ...MOCK_CHAT_BRIDGE };
  dispatchMessage({ type: 'CHAT_BRIDGE_INFO', sessionName: mockState.sessionName, bridgeInfo: mockChat.bridgeInfo });
}

// ---------------------------------------------------------------------------
// Message handler (routes chrome.runtime.sendMessage calls)
// ---------------------------------------------------------------------------

async function handleSendMessage(message: { type: string; [key: string]: unknown }): Promise<unknown> {
  switch (message.type) {
    case 'DISCOVER_SESSIONS':
      return { sessions: MOCK_SESSIONS };

    case 'GET_CONNECTION_STATUS':
      return {
        connected: mockState.connected,
        sessionName: mockState.sessionName,
        tabId: mockState.connected ? 1 : null,
      };

    case 'CONNECT_SESSION':
      mockState.connected = true;
      mockState.sessionName = message.sessionName as string;
      return { success: true };

    case 'DISCONNECT_SESSION':
      mockState.connected = false;
      mockState.sessionName = null;
      return { success: true };

    case 'SYNC_SELECTIONS':
      mockChat.captureCount = Array.isArray(message.selections) ? message.selections.length : 0;
      return undefined;

    case 'CAPTURE_ELEMENT_SCREENSHOT': {
      const rect = message.rect as { width: number; height: number } | undefined;
      const w = rect?.width ?? 384;
      const h = rect?.height ?? 216;
      return { image: generateMockScreenshot(w, h) };
    }

    case 'SET_COMPUTED_STYLES_MODE':
      return undefined;

    case 'START_ELEMENT_PICKER':
      mockState.pickerActive = true;
      return { success: true };

    case 'DEVTOOLS_OPENED':
    case 'DEVTOOLS_CLOSED':
    case 'DEVTOOLS_ELEMENT_SELECTED':
      return undefined;

    case 'GET_CHAT_STATE':
      return mockState.connected
        ? { sessionName: mockState.sessionName, bridgeInfo: mockChat.bridgeInfo, history: [...mockChat.history] }
        : { sessionName: null, bridgeInfo: null, history: [] };

    case 'CHAT_SEND': {
      if (!mockChat.bridgeInfo.available) {
        return { ok: false, error: mockChat.bridgeInfo.reason };
      }
      const entry = {
        id: `mock-sent-${Date.now()}`,
        role: 'you',
        text: String(message.text).trim(),
        ts: Date.now(),
        attachments: mockChat.captureCount,
        ...(Array.isArray(message.thumbnails) && { thumbnails: message.thumbnails }),
        status: 'sending',
      };
      upsertChatEntry(entry);
      await new Promise((r) => setTimeout(r, 300));
      upsertChatEntry({ ...entry, status: 'sent' });
      setTimeout(() => simulateChatReply(), 1200);
      return { ok: true };
    }

    default:
      console.warn('[mock-chrome] Unhandled message type:', message.type);
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// Install mock
// ---------------------------------------------------------------------------

export function installMockChrome(): void {
  (window as any).chrome = {
    runtime: {
      sendMessage: (msg: any) => handleSendMessage(msg),
      onMessage: {
        addListener: (fn: (message: any) => void) => {
          messageListeners.push(fn);
        },
        removeListener: (fn: (message: any) => void) => {
          const idx = messageListeners.indexOf(fn);
          if (idx !== -1) messageListeners.splice(idx, 1);
        },
      },
    },

    storage: {
      local: {
        get: async (key: string) => {
          if (typeof key === 'string') {
            return { [key]: storage.get(key) };
          }
          return {};
        },
        set: async (items: Record<string, unknown>) => {
          for (const [k, v] of Object.entries(items)) {
            storage.set(k, v);
          }
        },
      },
    },

    devtools: {
      inspectedWindow: {
        tabId: 1,
        eval: (_expr: string, callback?: (result: any, isException: boolean) => void) => {
          if (callback) callback(null, true);
        },
      },
      panels: {
        create: () => {},
        elements: {
          onSelectionChanged: {
            addListener: () => {},
          },
        },
      },
    },

    tabs: {
      sendMessage: async () => undefined,
      captureVisibleTab: async () => generateMockScreenshot(384, 216),
    },

    scripting: {
      executeScript: async () => [{ result: true }],
    },

    alarms: {
      create: () => {},
      clear: () => {},
      onAlarm: {
        addListener: () => {},
      },
    },
  };
}
