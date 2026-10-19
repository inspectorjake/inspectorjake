#!/usr/bin/env node
/**
 * Jake MCP MCP Server - CLI Entry Point
 *
 * Starts the MCP server with a session name (jake, annie, kevin, or elsa)
 * and waits for Chrome extension connections via WebSocket.
 */

import { createRequire } from 'module';
import { randomUUID } from 'crypto';
import { createMcpServer, type SessionState } from './server.js';
import { createWsServer, type WsServerHooks } from './ws-server.js';
import { createSessionBridge, bridgeNameFor } from './session-bridge.js';
import { buildChatBody } from './response-builder.js';
import { nameToPort, SESSION_NAMES, type SessionName } from '@inspector-jake/shared';
import { log } from './logger.js';

function readVersion(): string {
  try {
    // dist/index.js and src/index.ts both sit one level below package.json
    return createRequire(import.meta.url)('../package.json').version;
  } catch {
    return 'unknown';
  }
}

/**
 * Exit when Claude Code goes away (stdin closes) or on a signal, removing the
 * bridge's socket and registry entry so it doesn't linger in the session list.
 */
function installShutdown(state: SessionState): void {
  let shuttingDown = false;
  const shutdown = (reason: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log.info('Main', `Shutting down (${reason})`);
    state.bridge.close();
    state.wsServer.close();
    process.exit(0);
  };

  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
    process.on(signal, () => shutdown(signal));
  }
  process.stdin.on('end', () => shutdown('stdin closed'));
  process.stdin.on('close', () => shutdown('stdin closed'));
  process.on('exit', () => state.bridge.close());
}

async function main() {
  log.info('Main', "Jake MCP MCP Server starting...");

  // Try to find an available port by scanning names in order: jake, annie, kevin, elsa
  let sessionName: SessionName | null = null;
  let port: number | null = null;

  // Hooks read `state` at call time, so they follow set_session_name swaps
  let state: SessionState | null = null;
  const wsHooks: WsServerHooks = {
    getChatBridgeInfo: () =>
      state?.bridge.info() ?? { available: false, reason: 'The MCP server is still starting.' },
    onChatSend: async (message) => {
      if (!state) throw new Error('The MCP server is still starting.');
      const info = state.bridge.info();
      if (!info.available) throw new Error(info.reason ?? 'Chat is not available.');
      await state.bridge.send(
        buildChatBody({
          text: message.text,
          page: message.page,
          selections: message.selections,
          replyTo: info.name!,
        })
      );
    },
  };

  let wsServer: Awaited<ReturnType<typeof createWsServer>> | null = null;
  for (const candidateName of SESSION_NAMES) {
    const candidatePort = nameToPort(candidateName);

    try {
      // Try to start WebSocket server on this port
      wsServer = await createWsServer(candidatePort, wsHooks);
    } catch (err) {
      // Port likely in use, try next name
      log.debug('Main', `Port ${candidatePort} in use, trying next...`);
      continue;
    }
    // Set the session name so discovery responses include it
    wsServer.setSessionName(candidateName);
    sessionName = candidateName;
    port = candidatePort;
    break;
  }

  if (!wsServer || !sessionName || !port) {
    log.error('Main', 'Could not find an available port. All session names are in use.');
    process.exit(1);
  }

  log.info('Main', `Session: ${sessionName}, Port: ${port}`);
  log.info('Main', 'Waiting for browser connection...');

  const bridge = await createSessionBridge({
    name: bridgeNameFor(sessionName),
    version: readVersion(),
    onInbound: (message) =>
      state?.wsServer.pushToClient({
        type: 'chat_message',
        id: randomUUID(),
        from: message.from,
        ...(message.fromName && { fromName: message.fromName }),
        text: message.text,
        ts: Date.now(),
      }),
    onStatus: (status) =>
      state?.wsServer.pushToClient({
        type: 'chat_status',
        status: status.status,
        ...(status.reason && { reason: status.reason }),
        ts: Date.now(),
      }),
  });

  state = { wsServer, sessionInfo: { sessionName, port }, wsHooks, bridge };
  installShutdown(state);

  // Start MCP server with mutable session state
  await createMcpServer(state);
}

main().catch((err) => {
  log.error('Main', 'Fatal error:', err);
  process.exit(1);
});
