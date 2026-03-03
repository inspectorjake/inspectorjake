/**
 * Composable for managing unified selections (elements and screenshots).
 * Extracted from Panel.vue to improve testability and reusability.
 */
import { ref, computed } from 'vue';
import type { Selection, ElementSelection, ScreenshotSelection, ElementInfo } from '@inspector-jake/shared';
import { log } from '../../utils/logger.js';

/**
 * Composable for unified selection state management.
 * Handles elements and screenshots in a single array with deduplication.
 */
// Global counter for unique IDs (persists across composable instances)
let idCounter = 0;

export function useSelections() {
  // Core state
  const selections = ref<Selection[]>([]);
  const expandedId = ref<string | null>(null);

  // Deduplication guards
  let lastAddedSelector: string | null = null;
  let lastAddedTime = 0;
  let lastScreenshotRect: string | null = null;
  let lastScreenshotTime = 0;

  // Computed: currently expanded selection
  const expandedSelection = computed(() =>
    selections.value.find((s) => s.id === expandedId.value) || null
  );

  /**
   * Toggle expanded state for a selection.
   */
  function toggleExpanded(id: string): void {
    expandedId.value = expandedId.value === id ? null : id;
  }

  /**
   * Sync selections to background script for MCP tool responses.
   */
  async function syncSelectionsToBackground(): Promise<void> {
    try {
      await chrome.runtime.sendMessage({
        type: 'SYNC_SELECTIONS',
        selections: selections.value,
      });
    } catch (err) {
      log.error('useSelections', 'Failed to sync selections:', err);
    }
  }

  /**
   * Add an element selection with auto-captured screenshot.
   * Handles deduplication by selector and time-based debouncing.
   */
  async function addElementSelection(
    element: ElementInfo,
    captureScreenshot?: (
      rect: { x: number; y: number; width: number; height: number },
      selector?: string,
      frameId?: number
    ) => Promise<string | null>
  ): Promise<void> {
    if (!element?.rect) return;

    // Validate rect dimensions to prevent NaN in selection data
    const rectWidth = Number.isFinite(element.rect.width) ? element.rect.width : 0;
    const rectHeight = Number.isFinite(element.rect.height) ? element.rect.height : 0;
    if (rectWidth === 0 && rectHeight === 0) {
      log.warn('useSelections', `Skipping element with zero-area rect: selector=${element.selector}`);
      return;
    }

    // Skip if this selector is already in the list
    if (selections.value.some((s) => s.type === 'element' && s.selector === element.selector)) {
      return;
    }

    // Debounce: prevent duplicate adds within 100ms for same selector
    const now = Date.now();
    if (element.selector === lastAddedSelector && now - lastAddedTime < 100) {
      return;
    }
    lastAddedSelector = element.selector;
    lastAddedTime = now;

    // Capture screenshot if callback provided
    let screenshot: string | null = null;
    if (captureScreenshot) {
      log.debug('useSelections', `Capturing screenshot for selector=${element.selector}, frameId=${element.frameId ?? 'none (top frame)'}`);
      screenshot = await captureScreenshot(element.rect, element.selector, element.frameId);
      log.debug('useSelections', `Screenshot result: ${screenshot ? 'captured' : 'null'}, frameId=${element.frameId ?? 'none'}`);
    }

    const newSelection: ElementSelection = {
      id: `elem-${Date.now()}-${++idCounter}`,
      type: 'element',
      timestamp: Date.now(),
      image: screenshot || '',
      width: Math.round(rectWidth),
      height: Math.round(rectHeight),
      selector: element.selector,
      tagName: element.tagName,
      className: element.className,
      rect: element.rect,
      attributes: element.attributes,
      computedStyles: element.computedStyles,
      a11yPath: element.a11yPath,
      frameId: element.frameId,
      screenshotUnavailableReason: screenshot ? undefined : 'Screenshot unavailable (iframe restrictions)',
    };

    selections.value.push(newSelection);
    log.debug('useSelections', `Selection added: id=${newSelection.id}, frameId=${element.frameId ?? 'none'}, hasImage=${!!screenshot}, reason=${newSelection.screenshotUnavailableReason ?? 'n/a'}`);

    // Auto-expand the new selection
    expandedId.value = newSelection.id;

    syncSelectionsToBackground();
  }

  /**
   * Add a screenshot selection (region capture).
   * Handles deduplication by rect and time-based debouncing.
   */
  function addScreenshotSelection(
    rect: { x: number; y: number; width: number; height: number },
    image: string
  ): void {
    // Debounce: prevent duplicate adds within 100ms for same rect
    const rectKey = `${rect.x},${rect.y},${rect.width},${rect.height}`;
    const now = Date.now();
    if (rectKey === lastScreenshotRect && now - lastScreenshotTime < 100) {
      return;
    }
    lastScreenshotRect = rectKey;
    lastScreenshotTime = now;

    const newSelection: ScreenshotSelection = {
      id: `shot-${Date.now()}-${++idCounter}`,
      type: 'screenshot',
      timestamp: Date.now(),
      image,
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      rect,
    };

    selections.value.push(newSelection);

    // Auto-expand the new selection
    expandedId.value = newSelection.id;

    syncSelectionsToBackground();
  }

  /**
   * Remove a selection by ID.
   */
  function removeSelection(id: string): void {
    selections.value = selections.value.filter((s) => s.id !== id);
    if (expandedId.value === id) {
      expandedId.value = null;
    }
    syncSelectionsToBackground();
  }

  /**
   * Update the note on a selection by ID.
   */
  function updateSelectionNote(id: string, note: string): void {
    const selection = selections.value.find((s) => s.id === id);
    if (selection) {
      selection.note = note;
      syncSelectionsToBackground();
    }
  }

  /**
   * Refresh computed styles for the currently expanded element selection.
   * Re-fetches styles from content script using the current mode setting.
   */
  async function refreshExpandedStyles(): Promise<void> {
    const selection = expandedSelection.value;
    if (!selection || selection.type !== 'element') {
      return;
    }

    const tabId = chrome.devtools?.inspectedWindow?.tabId;
    if (!tabId) {
      return;
    }

    try {
      log.debug('useSelections', `refreshExpandedStyles: selector=${selection.selector}, frameId=${selection.frameId ?? 'none (broadcast)'}`);
      const msg = { type: 'REFRESH_ELEMENT_STYLES', selector: selection.selector };
      const response = selection.frameId !== undefined
        ? await chrome.tabs.sendMessage(tabId, msg, { frameId: selection.frameId } as any)
        : await chrome.tabs.sendMessage(tabId, msg);

      if (response?.success) {
        selection.computedStyles = response.computedStyles;
        syncSelectionsToBackground();
      }
    } catch {
      // Element may no longer exist or content script may be unavailable.
    }
  }

  /**
   * Clear all selections.
   */
  function clearAllSelections(): void {
    selections.value = [];
    expandedId.value = null;
    syncSelectionsToBackground();
  }

  return {
    // State
    selections,
    expandedId,

    // Computed
    expandedSelection,

    // Methods
    toggleExpanded,
    addElementSelection,
    addScreenshotSelection,
    removeSelection,
    updateSelectionNote,
    refreshExpandedStyles,
    clearAllSelections,
    syncSelectionsToBackground,
  };
}
