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
    captureScreenshot?: (rect: { x: number; y: number; width: number; height: number }) => Promise<string | null>
  ): Promise<void> {
    if (!element?.rect) return;

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
      screenshot = await captureScreenshot(element.rect);
      if (!screenshot) return;
    }

    const newSelection: ElementSelection = {
      id: `elem-${Date.now()}-${++idCounter}`,
      type: 'element',
      timestamp: Date.now(),
      image: screenshot || '',
      width: Math.round(element.rect.width),
      height: Math.round(element.rect.height),
      selector: element.selector,
      tagName: element.tagName,
      className: element.className,
      rect: element.rect,
      attributes: element.attributes,
    };

    selections.value.push(newSelection);

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
    clearAllSelections,
    syncSelectionsToBackground,
  };
}
