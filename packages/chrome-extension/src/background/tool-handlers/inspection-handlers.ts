/**
 * Inspection tool handlers for InspectorJake MCP tools.
 *
 * Handles see_jakes_notes (selections), view_image_in_jakes_notes,
 * and get_page_info (combined page info with ARIA snapshot).
 */

import type {
  GetPageInfoRequest,
  GetPageInfoResponse,
  InteractiveContextResponse,
  ViewImageRequest,
} from '@inspector-jake/shared';
import {
  getSelections,
  clearSelections,
  buildSelectionsResponse,
  type SelectionResponse,
} from './selection-manager.js';
import { generateInteractiveSnapshot } from './page-scripts/generate-snapshot.js';

/**
 * Handle see_jakes_notes tool.
 * Returns all selections with differentiated response format.
 */
export async function handleGetSelections(): Promise<{ selections: SelectionResponse[] }> {
  const response = { selections: buildSelectionsResponse() };

  let shouldAutoClear = true;
  try {
    const result = await chrome.storage.local.get('autoClearSelectionsAfterSeen');
    if (typeof result.autoClearSelectionsAfterSeen === 'boolean') {
      shouldAutoClear = result.autoClearSelectionsAfterSeen;
    }
  } catch {
    // Keep default=true if settings read fails.
  }

  if (shouldAutoClear) {
    clearSelections();
    chrome.runtime.sendMessage({ type: 'SELECTIONS_AUTO_CLEARED' }).catch(() => {});
  }

  return response;
}

/**
 * Handle view_image tool.
 * Returns the stored image for an element selection by its ID.
 */
export function handleViewImage(
  payload: ViewImageRequest,
): { image: string; width: number; height: number } | { error: string } {
  const { imageId } = payload;
  const selection = getSelections().find((s) => s.id === imageId);

  if (!selection) {
    return { error: `No image found with id: ${imageId}` };
  }

  return {
    image: selection.image,
    width: selection.width,
    height: selection.height,
  };
}

/**
 * Handle page info request (internal helper for get_page_info).
 */
export async function handleGetPageInfo(tabId: number | null): Promise<GetPageInfoResponse> {
  if (!tabId) {
    throw new Error('No tab connected');
  }

  const tab = await chrome.tabs.get(tabId);

  // Get viewport dimensions
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => ({
      width: window.innerWidth,
      height: window.innerHeight,
    }),
  });

  const viewport = results[0]?.result || { width: 0, height: 0 };

  return {
    url: tab.url || '',
    title: tab.title || '',
    viewport,
  };
}

/**
 * Handle combined get_page_info tool.
 * Merges page info (URL, title, viewport) with interactive ARIA snapshot and selections.
 */
export async function handleCombinedPageInfo(
  tabId: number | null,
  payload: GetPageInfoRequest,
): Promise<InteractiveContextResponse> {
  if (!tabId) {
    throw new Error('No tab connected');
  }

  // Get page info
  const tab = await chrome.tabs.get(tabId);

  // Get viewport dimensions
  const viewportResults = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => ({
      width: window.innerWidth,
      height: window.innerHeight,
    }),
  });

  const viewport = viewportResults[0]?.result || { width: 0, height: 0 };

  // Generate ARIA snapshot with refs
  const snapshotResults = await chrome.scripting.executeScript({
    target: { tabId },
    func: generateInteractiveSnapshot,
    args: [payload.selector || null],
  });

  if (!snapshotResults || snapshotResults.length === 0 || !snapshotResults[0].result) {
    throw new Error('Failed to generate page snapshot');
  }

  return {
    url: tab.url || '',
    title: tab.title || '',
    viewport,
    snapshot: snapshotResults[0].result,
  };
}
