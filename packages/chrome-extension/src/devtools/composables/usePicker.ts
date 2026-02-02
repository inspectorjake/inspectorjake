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
  highlightSelector: (selector: string) => Promise<void>;
  clearHighlight: () => void;
  captureElementScreenshot: (rect: BoundingRect) => Promise<string | null>;
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
 */
async function sendToContentScript(
  tabId: number,
  message: { type: string; [key: string]: unknown }
): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch {
    // Content script might not be injected yet
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['src/content/index.js'],
    });
    await chrome.tabs.sendMessage(tabId, message);
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

  async function highlightSelector(selector: string): Promise<void> {
    const tabId = getTabId();
    if (!tabId || !selector) return;

    try {
      await chrome.tabs.sendMessage(tabId, {
        type: PickerMessageType.HIGHLIGHT,
        selector,
      });
    } catch {
      // Content script not loaded, ignore
    }
  }

  function clearHighlight(): void {
    const tabId = getTabId();
    if (!tabId) return;

    chrome.tabs.sendMessage(tabId, { type: PickerMessageType.CLEAR_HIGHLIGHT }).catch(() => {});
  }

  async function captureElementScreenshot(rect: BoundingRect): Promise<string | null> {
    const tabId = getTabId();
    if (!tabId) {
      log.error('usePicker', 'No inspected tab for screenshot');
      return null;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: PickerMessageType.CAPTURE_SCREENSHOT,
        rect,
        tabId,
      });

      // Start cooldown to avoid exceeding Chrome's captureVisibleTab quota
      isCoolingDown.value = true;
      setTimeout(() => {
        isCoolingDown.value = false;
      }, SCREENSHOT_COOLDOWN_MS);

      return response?.image ?? null;
    } catch (err) {
      log.error('usePicker', 'Failed to capture element screenshot:', err);
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
