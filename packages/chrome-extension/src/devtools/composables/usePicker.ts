/**
 * Composable for element picker functionality.
 * Handles picker state, highlighting, and screenshot capture.
 * Extracted from Panel.vue to improve testability and reusability.
 */
import { ref, type Ref, readonly } from 'vue';
import { log } from '../../utils/logger.js';

/** Message types for content script communication */
export const PickerMessageType = {
  START: 'START_ELEMENT_PICKER',
  STOP: 'STOP_ELEMENT_PICKER',
  HIGHLIGHT: 'HIGHLIGHT_SELECTOR',
  CLEAR_HIGHLIGHT: 'CLEAR_HIGHLIGHT',
  CAPTURE_SCREENSHOT: 'CAPTURE_ELEMENT_SCREENSHOT',
} as const;

/** Bounding rectangle for element/region */
export interface BoundingRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Return type for usePicker composable */
export interface UsePickerReturn {
  isPicking: Readonly<Ref<boolean>>;
  error: Readonly<Ref<string | null>>;
  isCoolingDown: Readonly<Ref<boolean>>;
  startElementPicker: () => Promise<void>;
  stopElementPicker: () => void;
  highlightSelector: (selector: string, frameId?: number) => Promise<void>;
  clearHighlight: (frameId?: number) => void;
  captureElementScreenshot: (rect: BoundingRect, selector?: string, frameId?: number) => Promise<string | null>;
  cancelPicking: () => void;
}

/** Cooldown duration in ms to avoid Chrome's captureVisibleTab quota */
const SCREENSHOT_COOLDOWN_MS = 1000;

/**
 * Get current tab ID from DevTools context.
 */
function getTabId(): number | undefined {
  return chrome.devtools?.inspectedWindow?.tabId;
}

/**
 * Send message to content script, injecting it first if needed.
 * When frameId is specified, targets that specific frame.
 */
async function sendToContentScript(
  tabId: number,
  message: { type: string; [key: string]: unknown },
  frameId?: number
): Promise<void> {
  const sendMsg = frameId !== undefined
    ? () => chrome.tabs.sendMessage(tabId, message, { frameId } as any)
    : () => chrome.tabs.sendMessage(tabId, message);
  try {
    await sendMsg();
  } catch {
    // Content script might not be injected yet
    const scriptTarget: chrome.scripting.InjectionTarget = frameId !== undefined
      ? { tabId, frameIds: [frameId] }
      : { tabId };
    await chrome.scripting.executeScript({
      target: scriptTarget,
      files: ['src/content/index.js'],
    });
    await sendMsg();
  }
}

/**
 * Composable for element picker state and operations.
 */
export function usePicker(): UsePickerReturn {
  const isPicking = ref(false);
  const error = ref<string | null>(null);
  const isCoolingDown = ref(false);

  async function startElementPicker(): Promise<void> {
    const tabId = getTabId();
    if (!tabId) {
      error.value = 'No inspected tab';
      return;
    }

    isPicking.value = true;
    error.value = null;

    try {
      await sendToContentScript(tabId, { type: PickerMessageType.START });
    } catch (err) {
      error.value = 'Failed to start element picker';
      isPicking.value = false;
      log.error('usePicker', 'Failed to start element picker:', err);
    }
  }

  function stopElementPicker(): void {
    const tabId = getTabId();
    if (tabId) {
      chrome.tabs.sendMessage(tabId, { type: PickerMessageType.STOP }).catch(() => {});
    }
    isPicking.value = false;
  }

  async function highlightSelector(selector: string, frameId?: number): Promise<void> {
    const tabId = getTabId();
    if (!tabId || !selector) return;

    try {
      log.debug('usePicker', `highlightSelector: selector=${selector}, frameId=${frameId ?? 'none (broadcast)'}`);
      const msg = { type: PickerMessageType.HIGHLIGHT, selector };
      if (frameId !== undefined) {
        await chrome.tabs.sendMessage(tabId, msg, { frameId } as any);
      } else {
        await chrome.tabs.sendMessage(tabId, msg);
      }
    } catch {
      // Content script not loaded, ignore
    }
  }

  function clearHighlight(frameId?: number): void {
    const tabId = getTabId();
    if (!tabId) return;

    // When frameId is known, target that frame; otherwise broadcast to all frames
    const msg = { type: PickerMessageType.CLEAR_HIGHLIGHT };
    const send = frameId !== undefined
      ? chrome.tabs.sendMessage(tabId, msg, { frameId } as any)
      : chrome.tabs.sendMessage(tabId, msg);
    send.catch(() => {});
  }

  async function captureElementScreenshot(rect: BoundingRect, selector?: string, frameId?: number): Promise<string | null> {
    const tabId = getTabId();
    if (!tabId) {
      log.error('usePicker', 'No inspected tab for screenshot');
      return null;
    }

    log.debug('usePicker', `captureElementScreenshot: selector=${selector ?? 'none'}, frameId=${frameId ?? 'none'}, rect=${JSON.stringify(rect)}`);
    try {
      const message: { type: string; rect: BoundingRect; tabId: number; selector?: string; frameId?: number } = {
        type: PickerMessageType.CAPTURE_SCREENSHOT,
        rect,
        tabId,
      };
      if (selector) {
        message.selector = selector;
      }
      if (frameId !== undefined) {
        message.frameId = frameId;
      }

      const response = await chrome.runtime.sendMessage(message);

      // Start cooldown to avoid exceeding Chrome's captureVisibleTab quota
      isCoolingDown.value = true;
      setTimeout(() => {
        isCoolingDown.value = false;
      }, SCREENSHOT_COOLDOWN_MS);

      const result = response?.image ?? null;
      log.debug('usePicker', `captureElementScreenshot result: ${result ? 'captured' : 'null'}, frameId=${frameId ?? 'none'}`);
      return result;
    } catch (err) {
      log.error('usePicker', `Failed to capture element screenshot (frameId=${frameId ?? 'none'}):`, err);
      return null;
    }
  }

  function cancelPicking(): void {
    isPicking.value = false;
  }

  return {
    // State (readonly to prevent external mutation)
    isPicking: readonly(isPicking),
    error: readonly(error),
    isCoolingDown: readonly(isCoolingDown),

    // Methods
    startElementPicker,
    stopElementPicker,
    highlightSelector,
    clearHighlight,
    captureElementScreenshot,
    cancelPicking,
  };
}
