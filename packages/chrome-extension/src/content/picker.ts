/**
 * Element picker — hover-highlight + click-to-select + drag-to-screenshot.
 */

import { CONTENT_SCRIPT_VERSION, DRAG_THRESHOLD } from './constants.js';
import {
  createHighlightOverlay,
  updateHighlight,
  hideHighlight,
  removeHighlightOverlay,
  removeDragRegionOverlay,
  updateDragRegion,
  hideDragRegion,
  getHighlightOverlay,
  getLabelOverlay,
  getDragRegionOverlay,
} from './overlays.js';
import { safeSendMessage } from './message-handler.js';

// ============================================================================
// Picker state
// ============================================================================

let isPicking = false;
let hoveredElement: Element | null = null;
let cursorStyleTag: HTMLStyleElement | null = null;
let dragStartPos: { x: number; y: number } | null = null;
let isDragging = false;
let suppressNextLeftClick = false;

// ============================================================================
// Helpers
// ============================================================================

function isCurrentVersion(): boolean {
  return (window as any).__jakeMcpVersion === CONTENT_SCRIPT_VERSION;
}

/**
 * Resolve the actual target element from a mouse event.
 * In Chrome responsive/device mode, e.target often resolves to body/html
 * instead of the actual element. Falls back to elementFromPoint.
 */
function resolveTarget(e: MouseEvent): Element | null {
  const target = e.target as Element;
  const highlightEl = getHighlightOverlay();
  const labelEl = getLabelOverlay();
  const dragEl = getDragRegionOverlay();

  if (target === highlightEl || target === labelEl || target === dragEl) {
    return null;
  }

  if (target !== document.documentElement && target !== document.body) {
    return target;
  }

  const resolved = document.elementFromPoint(e.clientX, e.clientY);
  if (
    !resolved ||
    resolved === document.documentElement ||
    resolved === document.body ||
    resolved === highlightEl ||
    resolved === labelEl ||
    resolved === dragEl
  ) {
    return null;
  }
  return resolved;
}

// ============================================================================
// Event handlers
// ============================================================================

function onMouseMove(e: MouseEvent) {
  if (!isPicking) return;

  if (dragStartPos) {
    const dx = Math.abs(e.clientX - dragStartPos.x);
    const dy = Math.abs(e.clientY - dragStartPos.y);

    if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
      isDragging = true;
      document.body.style.cursor = 'crosshair';
      hideHighlight();
      updateDragRegion(dragStartPos, e);
      return;
    }
  }

  const resolved = resolveTarget(e);
  if (!resolved) return;

  hoveredElement = resolved;
  updateHighlight(resolved);
}

function onMouseLeave() {
  if (!isPicking) return;
  hideHighlight();
  hoveredElement = null;
}

function onMouseDown(e: MouseEvent) {
  if (!isPicking) return;
  if (e.button !== 0) return;

  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
  dragStartPos = { x: e.clientX, y: e.clientY };
  isDragging = false;

  // Touch mode: no mousemove fires before mousedown, so resolve now
  if (!hoveredElement) {
    const resolved = resolveTarget(e);
    if (resolved) {
      hoveredElement = resolved;
      updateHighlight(resolved);
    }
  }
}

function onMouseUp(e: MouseEvent) {
  if (e.button !== 0) return;
  if (!isPicking || !dragStartPos) return;
  if (!isCurrentVersion()) return;

  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();

  if (isDragging) {
    const rect = {
      x: Math.min(dragStartPos.x, e.clientX),
      y: Math.min(dragStartPos.y, e.clientY),
      width: Math.abs(e.clientX - dragStartPos.x),
      height: Math.abs(e.clientY - dragStartPos.y),
    };

    if (rect.width > 20 && rect.height > 20) {
      safeSendMessage({ type: 'SCREENSHOT_REGION_SELECTED', rect });
    }

    hideDragRegion();
    suppressNextLeftClick = true;
    stopPicking();
  } else if (hoveredElement) {
    const element = hoveredElement;
    const info = (window as any).__jakesVibe.getElementInfo(element);

    safeSendMessage({ type: 'ELEMENT_PICKED', element: info });

    suppressNextLeftClick = true;
    stopPicking();
  }

  dragStartPos = null;
  isDragging = false;
}

function onKeyDown(e: KeyboardEvent) {
  if (!isPicking) return;
  if (!isCurrentVersion()) return;

  if (e.key === 'Escape') {
    e.preventDefault();
    hideDragRegion();
    stopPicking();
    safeSendMessage({ type: 'PICKER_CANCELLED' });
    return;
  }
}

function onWheel(e: WheelEvent) {
  if (!isPicking) return;
  if (isDragging) return;

  e.preventDefault();
  e.stopPropagation();

  if (e.deltaY < 0) {
    // Scroll up → zoom out → parent element
    if (hoveredElement?.parentElement &&
        hoveredElement.parentElement !== document.documentElement) {
      hoveredElement = hoveredElement.parentElement;
      updateHighlight(hoveredElement);
    }
  } else if (e.deltaY > 0) {
    // Scroll down → zoom in → re-resolve deepest element under cursor
    const deepest = document.elementFromPoint(e.clientX, e.clientY);
    const highlightEl = getHighlightOverlay();
    const labelEl = getLabelOverlay();
    const dragEl = getDragRegionOverlay();

    if (deepest && deepest !== highlightEl && deepest !== labelEl && deepest !== dragEl &&
        deepest !== document.documentElement && deepest !== document.body) {
      hoveredElement = deepest;
      updateHighlight(deepest);
    }
  }
}

function onClick(e: MouseEvent) {
  if (e.button !== 0) return;
  if (!isPicking && !suppressNextLeftClick) return;
  if (!isCurrentVersion()) return;

  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
  suppressNextLeftClick = false;
}

function onPointerDown(e: PointerEvent) {
  if (!isPicking) return;
  if (e.button !== 0) return;

  // Stop propagation to prevent page elements from seeing the pointer event.
  // Do NOT call preventDefault — that suppresses compat mousedown/mouseup/click
  // events that our own handlers rely on.
  e.stopPropagation();
  e.stopImmediatePropagation();
}

function onPointerUp(e: PointerEvent) {
  if (e.button !== 0) return;
  if (!isPicking && !suppressNextLeftClick) return;

  e.stopPropagation();
  e.stopImmediatePropagation();
}

function onContextMenu(e: MouseEvent) {
  if (!isPicking) return;

  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
}

// ============================================================================
// Public API
// ============================================================================

export function startPicking() {
  console.log('[Jake MCP Content] startPicking() called, current isPicking:', isPicking);
  if (isPicking) return;

  isPicking = true;
  console.log('[Jake MCP Content] isPicking set to true, adding event listeners');
  dragStartPos = null;
  isDragging = false;
  suppressNextLeftClick = false;

  createHighlightOverlay();

  cursorStyleTag = document.createElement('style');
  cursorStyleTag.id = 'inspector-jake-cursor';
  cursorStyleTag.textContent = '* { cursor: default !important; }';
  document.head.appendChild(cursorStyleTag);

  document.addEventListener('mousemove', onMouseMove, true);
  document.addEventListener('pointermove', onMouseMove as EventListener, true);
  document.addEventListener('mouseleave', onMouseLeave, true);
  document.addEventListener('mousedown', onMouseDown, true);
  document.addEventListener('mouseup', onMouseUp, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('pointerup', onPointerUp, true);
  document.addEventListener('contextmenu', onContextMenu, true);
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('wheel', onWheel, { capture: true, passive: false });
}

export function stopPicking() {
  if (!isPicking) return;

  isPicking = false;
  hoveredElement = null;
  dragStartPos = null;
  isDragging = false;

  document.removeEventListener('mousemove', onMouseMove, true);
  document.removeEventListener('pointermove', onMouseMove as EventListener, true);
  document.removeEventListener('mouseleave', onMouseLeave, true);
  document.removeEventListener('mousedown', onMouseDown, true);
  document.removeEventListener('mouseup', onMouseUp, true);
  document.removeEventListener('pointerdown', onPointerDown, true);
  document.removeEventListener('pointerup', onPointerUp, true);
  document.removeEventListener('contextmenu', onContextMenu, true);
  document.removeEventListener('keydown', onKeyDown, true);
  document.removeEventListener('wheel', onWheel, true);

  setTimeout(() => {
    document.removeEventListener('click', onClick, true);
  }, 0);

  hideHighlight();
  removeHighlightOverlay();
  removeDragRegionOverlay();

  if (cursorStyleTag) {
    cursorStyleTag.remove();
    cursorStyleTag = null;
  }
  document.body.style.cursor = '';
}

export function highlightBySelector(selector: string) {
  try {
    const el = document.querySelector(selector);
    if (el) {
      createHighlightOverlay();
      updateHighlight(el);
    }
  } catch {
    // Invalid selector, ignore
  }
}
