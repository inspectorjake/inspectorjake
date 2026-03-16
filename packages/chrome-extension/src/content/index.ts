/**
 * Jake MCP Content Script — entry point.
 *
 * Runs in the context of web pages. Provides:
 * - Console log capture
 * - Custom element picker with hover highlight
 * - Region screenshot selection
 * - DOM access for snapshots and element info
 */

import { CONTENT_SCRIPT_VERSION } from './constants.js';
import './console-capture.js';
import './network-capture.js';
import { cleanupStaleOverlays } from './overlays.js';
import { initMessageHandler } from './message-handler.js';
import './window-api.js';

// Note: Content scripts can't use the shared logger easily,
// so we use console.log with a prefix for traceability
console.log("[Jake MCP] Content script loaded");

// Track this script instance version (to detect orphaned scripts)
(window as any).__jakeMcpVersion = CONTENT_SCRIPT_VERSION;

// Remove stale overlays from previous script instances
cleanupStaleOverlays();

// Start listening for messages from background
initMessageHandler();
