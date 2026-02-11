/**
 * Region selection mode — full-screen overlay for drag-to-screenshot.
 * Triggered separately from the element picker via START_REGION_SELECTION.
 */

import { CONTENT_SCRIPT_VERSION, OVERLAY_IDS } from './constants.js';
import { safeSendMessage } from './message-handler.js';

// ============================================================================
// State
// ============================================================================

const regionState = {
  isActive: false,
  isDrawing: false,
  startX: 0,
  startY: 0,
  overlay: null as HTMLDivElement | null,
  selectionBox: null as HTMLDivElement | null,
  instructionLabel: null as HTMLDivElement | null,
};

// ============================================================================
// Overlay creation / cleanup
// ============================================================================

function createRegionOverlay() {
  if (regionState.overlay) return;

  regionState.overlay = document.createElement('div');
  regionState.overlay.id = OVERLAY_IDS.regionOverlay;
  regionState.overlay.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    background: rgba(15, 23, 42, 0.3) !important;
    cursor: crosshair !important;
    z-index: 2147483646 !important;
  `;
  document.documentElement.appendChild(regionState.overlay);

  regionState.selectionBox = document.createElement('div');
  regionState.selectionBox.id = OVERLAY_IDS.regionBox;
  regionState.selectionBox.style.cssText = `
    position: fixed !important;
    pointer-events: none !important;
    z-index: 2147483647 !important;
    background: rgba(34, 197, 94, 0.1) !important;
    border: 2px dashed #22C55E !important;
    border-radius: 2px !important;
    display: none !important;
  `;
  document.documentElement.appendChild(regionState.selectionBox);

  regionState.instructionLabel = document.createElement('div');
  regionState.instructionLabel.id = OVERLAY_IDS.regionLabel;
  regionState.instructionLabel.style.cssText = `
    position: fixed !important;
    top: 16px !important;
    left: 50% !important;
    transform: translateX(-50%) !important;
    background: #0F172A !important;
    color: #F8FAFC !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    font-size: 13px !important;
    padding: 8px 16px !important;
    border-radius: 6px !important;
    z-index: 2147483647 !important;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
  `;
  regionState.instructionLabel.textContent = 'Drag to select a region • Press Esc to cancel';
  document.documentElement.appendChild(regionState.instructionLabel);
}

function removeRegionOverlay() {
  if (regionState.overlay) {
    regionState.overlay.remove();
    regionState.overlay = null;
  }
  if (regionState.selectionBox) {
    regionState.selectionBox.remove();
    regionState.selectionBox = null;
  }
  if (regionState.instructionLabel) {
    regionState.instructionLabel.remove();
    regionState.instructionLabel = null;
  }
}

// ============================================================================
// Event handlers
// ============================================================================

function updateSelectionBox(e: MouseEvent) {
  if (!regionState.selectionBox || !regionState.isDrawing) return;

  const x = Math.min(regionState.startX, e.clientX);
  const y = Math.min(regionState.startY, e.clientY);
  const width = Math.abs(e.clientX - regionState.startX);
  const height = Math.abs(e.clientY - regionState.startY);

  regionState.selectionBox.style.display = 'block';
  regionState.selectionBox.style.left = `${x}px`;
  regionState.selectionBox.style.top = `${y}px`;
  regionState.selectionBox.style.width = `${width}px`;
  regionState.selectionBox.style.height = `${height}px`;
}

function onRegionMouseDown(e: MouseEvent) {
  if (!regionState.isActive) return;

  regionState.isDrawing = true;
  regionState.startX = e.clientX;
  regionState.startY = e.clientY;

  if (regionState.selectionBox) {
    regionState.selectionBox.style.display = 'none';
  }
}

function onRegionMouseMove(e: MouseEvent) {
  if (!regionState.isActive || !regionState.isDrawing) return;
  updateSelectionBox(e);
}

function onRegionMouseUp(e: MouseEvent) {
  if (!regionState.isActive || !regionState.isDrawing) return;
  if ((window as any).__jakeMcpVersion !== CONTENT_SCRIPT_VERSION) return;

  regionState.isDrawing = false;

  const x = Math.min(regionState.startX, e.clientX);
  const y = Math.min(regionState.startY, e.clientY);
  const width = Math.abs(e.clientX - regionState.startX);
  const height = Math.abs(e.clientY - regionState.startY);

  if (width < 10 || height < 10) return;

  safeSendMessage({
    type: 'CAPTURE_REGION_SCREENSHOT',
    rect: { x, y, width, height },
  });

  stopRegionSelection();
}

function onRegionKeyDown(e: KeyboardEvent) {
  if (!regionState.isActive) return;
  if ((window as any).__jakeMcpVersion !== CONTENT_SCRIPT_VERSION) return;

  if (e.key === 'Escape') {
    e.preventDefault();
    stopRegionSelection();
    safeSendMessage({ type: 'REGION_CANCELLED' });
  }
}

// ============================================================================
// Public API
// ============================================================================

export function startRegionSelection() {
  if (regionState.isActive) return;

  regionState.isActive = true;
  regionState.isDrawing = false;
  createRegionOverlay();

  if (regionState.overlay) {
    regionState.overlay.addEventListener('mousedown', onRegionMouseDown);
    regionState.overlay.addEventListener('mousemove', onRegionMouseMove);
    regionState.overlay.addEventListener('mouseup', onRegionMouseUp);
  }
  document.addEventListener('keydown', onRegionKeyDown, true);
}

export function stopRegionSelection() {
  if (!regionState.isActive) return;

  regionState.isActive = false;
  regionState.isDrawing = false;

  if (regionState.overlay) {
    regionState.overlay.removeEventListener('mousedown', onRegionMouseDown);
    regionState.overlay.removeEventListener('mousemove', onRegionMouseMove);
    regionState.overlay.removeEventListener('mouseup', onRegionMouseUp);
  }
  document.removeEventListener('keydown', onRegionKeyDown, true);

  removeRegionOverlay();
}
