/**
 * Selection Manager — manages DevTools element selections and screenshot
 * selections used by InspectorJake MCP tool responses.
 *
 * Owns the in-memory selection/element caches and the DevTools-open tracking
 * set, plus the helper that serialises selections into tool-response format.
 */

import type { ElementInfo, Selection } from '@inspector-jake/shared';
import { formatDimensions } from '@inspector-jake/shared';

// ---------------------------------------------------------------------------
// Element selection cache (keyed by tabId)
// ---------------------------------------------------------------------------

const selectedElements = new Map<number, ElementInfo | null>();

// ---------------------------------------------------------------------------
// Unified selections cache (set from the DevTools panel)
// ---------------------------------------------------------------------------

let storedSelections: Selection[] = [];

/**
 * Update selections (called from panel).
 */
export function updateSelections(selections: Selection[]): void {
  storedSelections = selections;
}

/**
 * Get selections for including in tool responses.
 */
export function getSelections(): Selection[] {
  return storedSelections;
}

/**
 * Clear all selections.
 */
export function clearSelections(): void {
  storedSelections = [];
}

// ---------------------------------------------------------------------------
// Legacy aliases for backward compatibility
// ---------------------------------------------------------------------------

export function updateAttachedSnapshots(snapshots: any[]): void {
  // Convert legacy snapshot format to selections if needed
  storedSelections = snapshots as Selection[];
}

export function getAttachedSnapshots(): any[] {
  return storedSelections;
}

export function clearAttachedSnapshots(): void {
  storedSelections = [];
}

// ---------------------------------------------------------------------------
// Selection response types & builder
// ---------------------------------------------------------------------------

/**
 * Selection response format for tool handlers.
 */
export interface SelectionResponse {
  type: 'element' | 'screenshot';
  id: string;
  image?: string;
  selector?: string;
  tagName?: string;
  className?: string;
  dimensions: string;
  rect: { x: number; y: number; width: number; height: number };
  computedStyles?: Record<string, string>;
  hint?: string;
  note?: string;
}

/**
 * Build selections response with differentiated format.
 * Single source of truth for selection response building.
 */
export function buildSelectionsResponse(
  selections: Selection[] = storedSelections,
): SelectionResponse[] {
  return selections.map((sel) => {
    const dimensions = formatDimensions(sel);
    const base: Pick<SelectionResponse, 'id' | 'dimensions' | 'rect' | 'note'> = {
      id: sel.id,
      dimensions,
      rect: sel.rect,
    };

    if (sel.note) {
      base.note = sel.note;
    }

    if (sel.type === 'screenshot') {
      return {
        type: 'screenshot' as const,
        ...base,
        image: sel.image,
      };
    }

    return {
      type: 'element' as const,
      ...base,
      selector: sel.selector,
      tagName: sel.tagName,
      className: sel.className,
      computedStyles: sel.computedStyles,
      hint: `Use view_user_selection_image tool with imageId="${sel.id}" to see this element's screenshot`,
    };
  });
}

// ---------------------------------------------------------------------------
// Selected element updates (per-tab)
// ---------------------------------------------------------------------------

/**
 * Update the selected element for a tab (called from DevTools panel).
 */
export function updateSelectedElement(tabId: number, element: ElementInfo | null): void {
  selectedElements.set(tabId, element);
}

// ---------------------------------------------------------------------------
// DevTools open/close tracking
// ---------------------------------------------------------------------------

const devToolsOpenTabs = new Set<number>();

export function markDevToolsOpen(tabId: number): void {
  devToolsOpenTabs.add(tabId);
}

export function markDevToolsClosed(tabId: number): void {
  devToolsOpenTabs.delete(tabId);
  selectedElements.delete(tabId);
}

export function isDevToolsOpen(tabId: number): boolean {
  return devToolsOpenTabs.has(tabId);
}
