// Chrome API mock for standalone preview mode.
// Installs a comprehensive window.chrome mock before Panel.vue mounts.

import { MOCK_SESSIONS, generateMockScreenshot } from './mock-data';

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

// ---------------------------------------------------------------------------
// Public helpers (used by StateController)
// ---------------------------------------------------------------------------

/** Dispatch a message to all registered onMessage listeners. */
export function dispatchMessage(message: Record<string, unknown>): void {
  for (const listener of messageListeners) {
    listener(message);
  }
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
