/**
 * WebSocket server for communication with Chrome extension.
 * Handles tool requests from MCP server and forwards to extension.
 * Includes HTTP health endpoint for silent discovery pre-checks.
 */

import { createServer, type Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import type {
  ToolResponse,
  ToolType,
  DiscoveryResponse,
  ChatBridgeInfo,
  ChatSendMessage,
  ChatServerMessage,
} from '@inspector-jake/shared';
import { log } from './logger.js';

const PING_INTERVAL_MS = 15000;
const REQUEST_TIMEOUT_MS = 30000;
/** Chat pushes kept while no extension is connected */
const MAX_OUTBOX = 50;

export interface WsServerHooks {
  /** Deliver a chat message typed in the DevTools panel. Rejects with a user-facing reason. */
  onChatSend?: (message: ChatSendMessage) => Promise<void>;
  /** Chat availability, sent to each extension when it connects. */
  getChatBridgeInfo?: () => ChatBridgeInfo;
}

export interface WsServerInstance {
  port: number;
  sendToolRequest: (type: ToolType, payload: unknown) => Promise<ToolResponse>;
  /** Push a chat message or status to the extension, buffering it while none is connected. */
  pushToClient: (message: ChatServerMessage) => void;
  isConnected: () => boolean;
  getDiscoveryInfo: () => DiscoveryResponse;
  setSessionName: (name: string) => void;
  close: () => void;
}

/**
 * Only Chrome extensions may connect. Browsers always send Origin on WebSocket
 * upgrades, so this stops web pages from driving the session through localhost.
 * Set INSPECTOR_JAKE_EXTENSION_IDS (comma-separated) to allow specific IDs only.
 */
export function isAllowedOrigin(
  origin: string | undefined,
  allowedIds: string[] = (process.env.INSPECTOR_JAKE_EXTENSION_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
): boolean {
  const match = origin?.match(/^chrome-extension:\/\/([a-p]{32})$/);
  if (!match) return false;
  return allowedIds.length === 0 || allowedIds.includes(match[1]);
}

function isChatSendMessage(message: any): message is ChatSendMessage {
  return (
    message?.type === 'chat_send' &&
    typeof message.id === 'string' &&
    typeof message.text === 'string' &&
    Array.isArray(message.selections)
  );
}

interface PendingRequest {
  resolve: (response: ToolResponse) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

export async function createWsServer(port: number, hooks: WsServerHooks = {}): Promise<WsServerInstance> {
  return new Promise((resolve, reject) => {
    const pendingRequests = new Map<string, PendingRequest>();
    const outbox: ChatServerMessage[] = [];
    let clientSocket: WebSocket | null = null;
    let sessionName: string = '';
    let connectedTabInfo: { id: number; title: string; url: string } | undefined;
    let pingInterval: NodeJS.Timeout | null = null;
    let isAlive = false;

    function startPingInterval(ws: WebSocket): void {
      stopPingInterval();
      isAlive = true;

      pingInterval = setInterval(() => {
        if (!isAlive) {
          log.warn('WS', 'Client did not respond to ping, terminating connection');
          ws.terminate();
          return;
        }

        isAlive = false;
        ws.ping();
        log.trace('WS', 'Sent ping to extension');
      }, PING_INTERVAL_MS);

      log.info('WS', 'Server-side ping interval started');
    }

    function stopPingInterval(): void {
      if (pingInterval) {
        clearInterval(pingInterval);
        pingInterval = null;
      }
    }

    function isClientConnected(): boolean {
      return clientSocket !== null && clientSocket.readyState === WebSocket.OPEN;
    }

    function discoveryInfo(): DiscoveryResponse {
      const claudeSession = hooks.getChatBridgeInfo?.().parentName;
      return {
        name: sessionName as any,
        status: clientSocket ? 'connected' : 'ready',
        connectedTab: connectedTabInfo,
        ...(claudeSession && { claudeSession }),
      };
    }

    function pushToClient(message: ChatServerMessage): void {
      if (isClientConnected()) {
        clientSocket!.send(JSON.stringify(message));
        return;
      }
      if (message.type === 'chat_message' || message.type === 'chat_status') {
        outbox.push(message);
        if (outbox.length > MAX_OUTBOX) outbox.shift();
      }
    }

    async function handleChatSend(ws: WebSocket, message: ChatSendMessage): Promise<void> {
      const ack = (ok: boolean, error?: string) =>
        ws.send(JSON.stringify({ type: 'chat_ack', id: message.id, ok, ...(error && { error }) }));

      if (!hooks.onChatSend) {
        ack(false, 'Chat is not available in this MCP server.');
        return;
      }
      try {
        await hooks.onChatSend(message);
        ack(true);
      } catch (err) {
        log.warn('WS', 'Chat send failed:', (err as Error).message);
        ack(false, (err as Error).message);
      }
    }

    // Create HTTP server for health endpoint (enables silent discovery pre-checks)
    const httpServer: HttpServer = createServer((req, res) => {
      // CORS headers for cross-origin fetch from extension
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      if (req.url === '/health' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'ok',
          session: sessionName,
          connected: isClientConnected(),
        }));
        return;
      }

      // 404 for other HTTP requests (WebSocket upgrade handled separately)
      res.writeHead(404);
      res.end();
    });

    // Create WebSocket server attached to HTTP server
    const wss = new WebSocketServer({
      server: httpServer,
      verifyClient: ({ origin }: { origin: string }) => {
        if (isAllowedOrigin(origin)) return true;
        log.warn('WS', `Rejected WebSocket connection from origin: ${origin || '(none)'}`);
        return false;
      },
    });

    // Handle WebSocketServer errors (fires when httpServer fails to bind)
    wss.on('error', (err) => {
      // Swallow - httpServer error handler will reject the promise
      log.debug('WS', 'WebSocketServer error (expected during port scan):', (err as Error).message);
    });

    httpServer.on('error', (err) => {
      reject(err);
    });

    httpServer.listen(port, '127.0.0.1', () => {
      // Server started successfully
      log.info('WS', `HTTP/WebSocket server listening on 127.0.0.1:${port}`);

      resolve({
        port,

        setSessionName: (name: string) => {
          sessionName = name;
          log.debug('WS', `Session name set to: ${name}`);
        },

        sendToolRequest: (type: ToolType, payload: unknown): Promise<ToolResponse> => {
          return new Promise((resolveReq, rejectReq) => {
            if (!isClientConnected()) {
              resolveReq({
                id: '',
                success: false,
                error: "No browser connection. Open the Inspector Jake extension and connect to this session.",
              });
              return;
            }

            const id = uuidv4();
            const request = { id, type, payload };

            // Set timeout for request (30 seconds)
            const timeout = setTimeout(() => {
              pendingRequests.delete(id);
              rejectReq(new Error('Request timed out'));
            }, REQUEST_TIMEOUT_MS);

            pendingRequests.set(id, {
              resolve: resolveReq,
              reject: rejectReq,
              timeout,
            });

            clientSocket!.send(JSON.stringify(request));
          });
        },

        pushToClient,

        isConnected: isClientConnected,

        getDiscoveryInfo: discoveryInfo,

        close: () => {
          stopPingInterval();
          wss.close();
          httpServer.close();
        },
      });
    });

    wss.on('connection', (ws, req) => {
      // Handle discovery requests (HTTP upgrade with specific path)
      const url = new URL(req.url || '/', `http://localhost:${port}`);

      if (url.pathname === '/discovery') {
        // Send discovery info and close
        // Wait for send to complete before closing to avoid race condition
        ws.send(JSON.stringify(discoveryInfo()), () => {
          ws.close();
        });
        return;
      }

      // Regular extension connection. Only one client at a time: a newer one replaces the old.
      log.info('WS', 'Browser extension connected');
      if (clientSocket && clientSocket !== ws) {
        log.info('WS', 'Closing previous extension connection');
        clientSocket.close(4000, 'Replaced by a newer connection');
      }
      clientSocket = ws;

      // Start server-side heartbeat
      startPingInterval(ws);

      if (hooks.getChatBridgeInfo) {
        ws.send(JSON.stringify({ type: 'chat_bridge_info', ...hooks.getChatBridgeInfo() }));
      }
      for (const message of outbox.splice(0)) {
        ws.send(JSON.stringify(message));
      }

      // Protocol-level pong handler (browser responds automatically to ws.ping())
      ws.on('pong', () => {
        isAlive = true;
        log.trace('WS', 'Received pong from extension');
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());

          // Handle tool responses
          if (message.id && pendingRequests.has(message.id)) {
            const pending = pendingRequests.get(message.id)!;
            clearTimeout(pending.timeout);
            pendingRequests.delete(message.id);
            pending.resolve(message as ToolResponse);
            log.trace('WS', `Tool response received: ${message.id}`);
            return;
          }

          // Handle application-level ping from extension
          if (message.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong' }));
            log.trace('WS', 'Received app-level ping, sent pong');
            return;
          }

          // Handle extension status updates
          if (message.type === 'EXTENSION_STATUS') {
            connectedTabInfo = message.tab;
            log.info('WS', `Connected to tab: ${message.tab?.title || 'unknown'}`);
            return;
          }

          // Chat message typed in the DevTools panel
          if (isChatSendMessage(message)) {
            void handleChatSend(ws, message);
          }
        } catch (err) {
          log.error('WS', 'Error parsing WebSocket message:', err);
        }
      });

      ws.on('close', () => {
        log.info('WS', 'Browser extension disconnected');
        // A replaced connection closing must not clear its successor
        if (clientSocket !== ws) return;
        stopPingInterval();
        clientSocket = null;
        connectedTabInfo = undefined;
      });

      ws.on('error', (err) => {
        log.error('WS', 'WebSocket error:', err);
      });
    });

  });
}
