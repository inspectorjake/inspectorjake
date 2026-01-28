/**
 * WebSocket client for connecting to Jake MCP MCP server.
 * Handles tool requests from server and forwards to appropriate handlers.
 */

import type { ToolRequest, ToolResponse, SessionName } from '@inspector-jake/shared';
import { handleToolRequest } from './tool-handlers.js';
import { log } from '../utils/logger.js';

export interface WsClientInstance {
  disconnect: () => void;
  isConnected: () => boolean;
  getSessionName: () => SessionName | null;
  sendStatusUpdate: (tab: { id: number; title: string; url: string } | null) => void;
}

let currentConnection: {
  ws: WebSocket;
  sessionName: SessionName;
  port: number;
  tabId: number | null;
} | null = null;

/**
 * Connect to an MCP server session.
 */
export function connectToSession(
  sessionName: SessionName,
  port: number,
  tabId: number
): Promise<WsClientInstance> {
  return new Promise((resolve, reject) => {
    // Disconnect existing connection if any
    if (currentConnection) {
      currentConnection.ws.close();
      currentConnection = null;
    }

    const ws = new WebSocket(`ws://127.0.0.1:${port}`);

    ws.onopen = () => {
      currentConnection = {
        ws,
        sessionName,
        port,
        tabId,
      };

      const instance: WsClientInstance = {
        disconnect: () => {
          ws.close();
          currentConnection = null;
        },

        isConnected: () => ws.readyState === WebSocket.OPEN,

        getSessionName: () => sessionName,

        sendStatusUpdate: (tab) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'EXTENSION_STATUS',
              tab,
            }));
          }
        },
      };

      // Send initial status
      chrome.tabs.get(tabId, (tab) => {
        if (tab) {
          instance.sendStatusUpdate({
            id: tabId,
            title: tab.title || 'Unknown',
            url: tab.url || 'Unknown',
          });
        }
      });

      resolve(instance);
    };

    ws.onmessage = async (event) => {
      try {
        const request = JSON.parse(event.data) as ToolRequest;
        log.debug('WS', `Tool request received: ${request.type}`);

        // Handle tool request
        const response = await handleToolRequest(request, currentConnection?.tabId || null);

        // Send response back
        ws.send(JSON.stringify(response));
        log.trace('WS', `Tool response sent: ${request.id}`);
      } catch (err) {
        log.error('WS', 'Error handling WebSocket message:', err);
      }
    };

    ws.onerror = (error) => {
      log.error('WS', 'WebSocket error:', error);
      reject(new Error('Failed to connect to MCP server'));
    };

    ws.onclose = () => {
      log.info('WS', 'WebSocket connection closed');
      currentConnection = null;
      // Notify popup about disconnection
      chrome.runtime.sendMessage({ type: 'CONNECTION_CLOSED' }).catch(() => {
        // Popup might be closed
      });
    };
  });
}

/**
 * Get current connection status.
 */
export function getConnectionStatus(): {
  connected: boolean;
  sessionName: SessionName | null;
  tabId: number | null;
} {
  if (!currentConnection || currentConnection.ws.readyState !== WebSocket.OPEN) {
    return { connected: false, sessionName: null, tabId: null };
  }

  return {
    connected: true,
    sessionName: currentConnection.sessionName,
    tabId: currentConnection.tabId,
  };
}

/**
 * Update the connected tab ID.
 */
export function updateConnectedTab(tabId: number): void {
  if (currentConnection) {
    currentConnection.tabId = tabId;
  }
}

/**
 * Disconnect current session.
 */
export function disconnectSession(): void {
  if (currentConnection) {
    currentConnection.ws.close();
    currentConnection = null;
  }
}
