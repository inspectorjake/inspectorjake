#!/usr/bin/env node
/**
 * Jake MCP MCP Server - CLI Entry Point
 *
 * Starts the MCP server with a session name (jake, annie, kevin, or elsa)
 * and waits for Chrome extension connections via WebSocket.
 */

import { createMcpServer } from './server.js';
import { createWsServer } from './ws-server.js';
import { nameToPort, SESSION_NAMES, type SessionName } from '@inspector-jake/shared';
import { log } from './logger.js';

async function main() {
  log.info('Main', "Jake MCP MCP Server starting...");

  // Try to find an available port by scanning names in order: jake, annie, kevin, elsa
  let sessionName: SessionName | null = null;
  let port: number | null = null;

  for (const candidateName of SESSION_NAMES) {
    const candidatePort = nameToPort(candidateName);

    try {
      // Try to start WebSocket server on this port
      const wsServer = await createWsServer(candidatePort);
      // Set the session name so discovery responses include it
      wsServer.setSessionName(candidateName);
      sessionName = candidateName;
      port = candidatePort;

      log.info('Main', `Session: ${sessionName}, Port: ${port}`);
      log.info('Main', 'Waiting for browser connection...');

      // Start MCP server with WebSocket server instance and session info
      await createMcpServer(wsServer, { sessionName, port });

      break;
    } catch (err) {
      // Port likely in use, try next name
      log.debug('Main', `Port ${candidatePort} in use, trying next...`);
      continue;
    }
  }

  if (!sessionName || !port) {
    log.error('Main', 'Could not find an available port. All session names are in use.');
    process.exit(1);
  }
}

main().catch((err) => {
  log.error('Main', 'Fatal error:', err);
  process.exit(1);
});
