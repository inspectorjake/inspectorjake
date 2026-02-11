/**
 * Tool handlers barrel — re-exports from modular subfiles.
 *
 * This file preserves the original public API so that existing
 * consumers (background/index.ts, tests) need no import changes.
 */

// Router
export { handleToolRequest } from './tool-handlers/router.js';

// Selection management
export {
  updateSelections,
  getSelections,
  clearSelections,
  updateAttachedSnapshots,
  getAttachedSnapshots,
  clearAttachedSnapshots,
  buildSelectionsResponse,
  updateSelectedElement,
  markDevToolsOpen,
  markDevToolsClosed,
  isDevToolsOpen,
  type SelectionResponse,
} from './tool-handlers/selection-manager.js';

// Screenshot utilities
export { captureElementScreenshot } from './tool-handlers/screenshot-handlers.js';
