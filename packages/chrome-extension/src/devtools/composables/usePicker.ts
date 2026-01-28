/**
 * Composable for element picker functionality.
 * Handles picker state, highlighting, and screenshot capture.
 * Extracted from Panel.vue to improve testability and reusability.
 */
import { ref } from 'vue';
import { log } from '../../utils/logger.js';

/**
 * Composable for element picker state and operations.
 */
export function usePicker() {
  // Core state
  const isPicking = ref(false);
  const error = ref<string | null>(null);

  /**
   * Get current tab ID from DevTools context.
   */
  function getTabId(): number | undefined {
    return chrome.devtools?.inspectedWindow?.tabId;
  }

  /**
   * Start the element picker.
   * Sends message to content script; injects if not present.
   */
  async function startElementPicker(): Promise<void> {
    const tabId = getTabId();
    if (!tabId) {
      error.value = 'No inspected tab';
      return;
    }

    isPicking.value = true;
    error.value = null;

    try {
      // Send message to content script to start picking
      await chrome.tabs.sendMessage(tabId, { type: 'START_ELEMENT_PICKER' });
    } catch (err) {
      // Content script might not be injected yet, inject it
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['src/content/index.js'],
        });
        // Try again
        await chrome.tabs.sendMessage(tabId, { type: 'START_ELEMENT_PICKER' });
      } catch (injectErr) {
        error.value = 'Failed to start element picker';
        isPicking.value = false;
        log.error('usePicker', 'Failed to start element picker:', injectErr);
      }
    }
  }

  /**
   * Stop the element picker.
   */
  function stopElementPicker(): void {
    const tabId = getTabId();
    if (tabId) {
      chrome.tabs.sendMessage(tabId, { type: 'STOP_ELEMENT_PICKER' }).catch(() => {});
    }
    isPicking.value = false;
  }

  /**
   * Highlight an element by selector (for preview on hover).
   */
  async function highlightSelector(selector: string): Promise<void> {
    const tabId = getTabId();
    if (!tabId || !selector) return;

    try {
      await chrome.tabs.sendMessage(tabId, {
        type: 'HIGHLIGHT_SELECTOR',
        selector,
      });
    } catch {
      // Content script not loaded, ignore
    }
  }

  /**
   * Clear any active highlight.
   */
  function clearHighlight(): void {
    const tabId = getTabId();
    if (!tabId) return;

    chrome.tabs.sendMessage(tabId, { type: 'CLEAR_HIGHLIGHT' }).catch(() => {});
  }

  /**
   * Capture a screenshot of a specific element by its bounding rect.
   */
  async function captureElementScreenshot(
    rect: { x: number; y: number; width: number; height: number }
  ): Promise<string | null> {
    const tabId = getTabId();
    if (!tabId) {
      log.error('usePicker', 'No inspected tab for screenshot');
      return null;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'CAPTURE_ELEMENT_SCREENSHOT',
        rect,
        tabId,
      });
      return response?.image || null;
    } catch (err) {
      log.error('usePicker', 'Failed to capture element screenshot:', err);
      return null;
    }
  }

  /**
   * Cancel picking (e.g., Escape pressed).
   */
  function cancelPicking(): void {
    isPicking.value = false;
  }

  return {
    // State
    isPicking,
    error,

    // Methods
    startElementPicker,
    stopElementPicker,
    highlightSelector,
    clearHighlight,
    captureElementScreenshot,
    cancelPicking,
  };
}
