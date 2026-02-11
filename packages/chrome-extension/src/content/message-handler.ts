/**
 * Chrome message handler — routes messages from background to content features.
 */

import { startPicking, stopPicking, highlightBySelector } from './picker.js';
import { startRegionSelection, stopRegionSelection } from './region-selection.js';
import { hideHighlight } from './overlays.js';

/**
 * Safely send message to background — handles invalidated extension context.
 */
export function safeSendMessage(message: any): void {
  try {
    if (chrome.runtime?.id) {
      chrome.runtime.sendMessage(message);
    }
  } catch (e) {
    console.warn('[Jake MCP] Extension context invalidated - reload page to reconnect');
  }
}

/**
 * Initialize the Chrome runtime message listener.
 */
export function initMessageHandler(): void {
  if (!chrome.runtime?.id) return;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    console.log('[Jake MCP Content] Received message:', message.type);

    switch (message.type) {
      case 'START_ELEMENT_PICKER':
        console.log('[Jake MCP Content] Starting picker...');
        startPicking();
        console.log('[Jake MCP Content] Picker started');
        sendResponse({ success: true });
        break;
      case 'STOP_ELEMENT_PICKER':
        stopPicking();
        sendResponse({ success: true });
        break;
      case 'HIGHLIGHT_SELECTOR':
        highlightBySelector(message.selector);
        sendResponse({ success: true });
        break;
      case 'CLEAR_HIGHLIGHT':
        hideHighlight();
        sendResponse({ success: true });
        break;
      case 'REFRESH_ELEMENT_STYLES': {
        const { selector } = message;

        if (!selector || typeof selector !== 'string') {
          sendResponse({ success: false, error: 'Invalid selector' });
          break;
        }

        try {
          const el = document.querySelector(selector);
          if (!el) {
            sendResponse({ success: false, error: 'Element not found' });
            break;
          }

          const info = (window as any).__jakesVibe.getElementInfo(el);
          sendResponse({ success: true, computedStyles: info.computedStyles });
        } catch {
          sendResponse({ success: false, error: 'Failed to refresh styles' });
        }
        break;
      }
      case 'START_REGION_SELECTION':
        startRegionSelection();
        sendResponse({ success: true });
        break;
      case 'STOP_REGION_SELECTION':
        stopRegionSelection();
        sendResponse({ success: true });
        break;
      default:
        sendResponse({ success: false, error: 'Unknown message type' });
    }
    return true;
  });
}
