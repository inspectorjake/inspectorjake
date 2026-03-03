/**
 * Content script constants — element IDs, thresholds, version tracking.
 */

export const CONTENT_SCRIPT_VERSION = Date.now();

export const DRAG_THRESHOLD = 10;

export const OVERLAY_IDS = {
  highlight: 'inspector-jake-highlight',
  label: 'inspector-jake-label',
  dragRegion: 'jake-mcp-drag-region',
  regionOverlay: 'inspector-jake-region-overlay',
  regionBox: 'inspector-jake-region-box',
  regionLabel: 'inspector-jake-region-label',
  cursor: 'inspector-jake-cursor',
  instruction: 'inspector-jake-instruction',
} as const;

export const MAX_CONSOLE_LOGS = 1000;
