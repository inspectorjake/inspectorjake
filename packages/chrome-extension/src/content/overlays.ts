/**
 * Overlay management — highlight overlay, drag region overlay, and cleanup.
 */

import { OVERLAY_IDS } from './constants.js';

// ============================================================================
// Highlight overlay (element picker)
// ============================================================================

let highlightOverlay: HTMLDivElement | null = null;
let labelOverlay: HTMLDivElement | null = null;
let instructionOverlay: HTMLDivElement | null = null;

export function createHighlightOverlay() {
  if (highlightOverlay) return;

  highlightOverlay = document.createElement('div');
  highlightOverlay.id = OVERLAY_IDS.highlight;
  highlightOverlay.style.cssText = `
    position: fixed !important;
    pointer-events: none !important;
    z-index: 2147483647 !important;
    background: rgba(34, 197, 94, 0.15) !important;
    border: 2px solid #22C55E !important;
    border-radius: 2px !important;
    box-shadow: 0 0 0 1px rgba(34, 197, 94, 0.3) !important;
    transition: all 50ms ease-out !important;
    display: none !important;
  `;
  document.documentElement.appendChild(highlightOverlay);

  labelOverlay = document.createElement('div');
  labelOverlay.id = OVERLAY_IDS.label;
  labelOverlay.style.cssText = `
    position: fixed !important;
    pointer-events: none !important;
    z-index: 2147483647 !important;
    background: #0F172A !important;
    color: #22C55E !important;
    font-family: 'SF Mono', 'Fira Code', monospace !important;
    font-size: 11px !important;
    padding: 4px 8px !important;
    border-radius: 4px !important;
    white-space: nowrap !important;
    display: none !important;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3) !important;
  `;
  document.documentElement.appendChild(labelOverlay);

  instructionOverlay = document.createElement('div');
  instructionOverlay.id = OVERLAY_IDS.instruction;
  instructionOverlay.style.cssText = `
    position: fixed !important;
    bottom: 16px !important;
    left: 50% !important;
    transform: translateX(-50%) !important;
    background: #0F172A !important;
    color: #94A3B8 !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    font-size: 12px !important;
    padding: 8px 16px !important;
    border-radius: 8px !important;
    z-index: 2147483647 !important;
    pointer-events: none !important;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4) !important;
    white-space: nowrap !important;
    letter-spacing: 0.01em !important;
  `;
  instructionOverlay.innerHTML =
    '<span style="color: #22C55E !important;">Click</span> to select · ' +
    '<span style="color: #22C55E !important;">Drag</span> to screenshot · ' +
    '<span style="color: #22C55E !important;">Scroll</span> ↑ parent ↓ child · ' +
    '<span style="color: #22C55E !important;">Esc</span> to cancel';
  document.documentElement.appendChild(instructionOverlay);
}

export function updateHighlight(el: Element) {
  if (!highlightOverlay || !labelOverlay) return;

  const rect = el.getBoundingClientRect();

  highlightOverlay.style.display = 'block';
  highlightOverlay.style.left = `${rect.left}px`;
  highlightOverlay.style.top = `${rect.top}px`;
  highlightOverlay.style.width = `${rect.width}px`;
  highlightOverlay.style.height = `${rect.height}px`;

  let label = (el.tagName || 'element').toLowerCase();
  if ((el as HTMLElement).id) {
    label += `#${(el as HTMLElement).id}`;
  } else if (el.className && typeof el.className === 'string') {
    const classes = el.className.trim().split(/\s+/).slice(0, 2);
    if (classes.length > 0) {
      label += `.${classes.join('.')}`;
    }
  }
  label += ` ${Math.round(rect.width)}×${Math.round(rect.height)}`;

  labelOverlay.textContent = label;
  labelOverlay.style.display = 'block';

  const labelRect = labelOverlay.getBoundingClientRect();
  let labelTop = rect.top - labelRect.height - 6;
  if (labelTop < 4) {
    labelTop = rect.bottom + 6;
  }
  let labelLeft = rect.left;
  if (labelLeft + labelRect.width > window.innerWidth - 4) {
    labelLeft = window.innerWidth - labelRect.width - 4;
  }

  labelOverlay.style.top = `${labelTop}px`;
  labelOverlay.style.left = `${Math.max(4, labelLeft)}px`;
}

export function hideHighlight() {
  if (highlightOverlay) highlightOverlay.style.display = 'none';
  if (labelOverlay) labelOverlay.style.display = 'none';
}

export function removeHighlightOverlay() {
  if (highlightOverlay) {
    highlightOverlay.remove();
    highlightOverlay = null;
  }
  if (labelOverlay) {
    labelOverlay.remove();
    labelOverlay = null;
  }
  if (instructionOverlay) {
    instructionOverlay.remove();
    instructionOverlay = null;
  }
}

export function getHighlightOverlay(): HTMLDivElement | null {
  return highlightOverlay;
}

export function getLabelOverlay(): HTMLDivElement | null {
  return labelOverlay;
}

// ============================================================================
// Drag region overlay
// ============================================================================

let dragRegionOverlay: HTMLDivElement | null = null;

export function createDragRegionOverlay() {
  if (dragRegionOverlay) return;

  dragRegionOverlay = document.createElement('div');
  dragRegionOverlay.id = OVERLAY_IDS.dragRegion;
  dragRegionOverlay.style.cssText = `
    position: fixed !important;
    pointer-events: none !important;
    z-index: 2147483647 !important;
    background: rgba(59, 130, 246, 0.15) !important;
    border: 2px dashed #3B82F6 !important;
    border-radius: 2px !important;
    display: none !important;
  `;
  document.documentElement.appendChild(dragRegionOverlay);
}

export function updateDragRegion(start: { x: number; y: number }, current: MouseEvent) {
  if (!dragRegionOverlay) createDragRegionOverlay();
  if (!dragRegionOverlay) return;

  const x = Math.min(start.x, current.clientX);
  const y = Math.min(start.y, current.clientY);
  const width = Math.abs(current.clientX - start.x);
  const height = Math.abs(current.clientY - start.y);

  dragRegionOverlay.style.display = 'block';
  dragRegionOverlay.style.left = `${x}px`;
  dragRegionOverlay.style.top = `${y}px`;
  dragRegionOverlay.style.width = `${width}px`;
  dragRegionOverlay.style.height = `${height}px`;
}

export function hideDragRegion() {
  if (dragRegionOverlay) {
    dragRegionOverlay.style.display = 'none';
  }
}

export function removeDragRegionOverlay() {
  if (dragRegionOverlay) {
    dragRegionOverlay.remove();
    dragRegionOverlay = null;
  }
}

export function getDragRegionOverlay(): HTMLDivElement | null {
  return dragRegionOverlay;
}

// ============================================================================
// Stale overlay cleanup
// ============================================================================

export function cleanupStaleOverlays() {
  const ids = Object.values(OVERLAY_IDS);
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.remove();
      console.log(`[Jake MCP] Cleaned up stale overlay: ${id}`);
    }
  });
}
