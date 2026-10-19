/**
 * MCP Server implementation for Inspector Jake.
 * Registers inspection tools and communicates with Chrome extension via WebSocket.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { WsServerHooks, WsServerInstance } from './ws-server.js';
import type { SessionBridge } from './session-bridge.js';
import { log } from './logger.js';
import { toolDefs, dispatchTool } from './tool-registry.js';

export interface SessionInfo {
  sessionName: string;
  port: number;
}

export interface SessionState {
  wsServer: WsServerInstance;
  sessionInfo: SessionInfo;
  /** Hooks given to every WS server, including ones created by set_session_name */
  wsHooks: WsServerHooks;
  /** Chat link to the Claude Code session that spawned this server */
  bridge: SessionBridge;
}

export async function createMcpServer(state: SessionState): Promise<void> {
  const chat = state.bridge.info();
  const chatInstructions = chat.available
    ? `

The user can also chat with you from the panel. Those messages arrive as cross-session messages from "${chat.name}"; reply with SendMessage to "${chat.name}" so the answer shows in the panel.`
    : '';

  const server = new Server(
    {
      name: 'vibejake',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
      instructions: `Inspector Jake MCP Server

Session Name: ${state.sessionInfo.sessionName}
Port: ${state.sessionInfo.port}

To use this server:
1. Open Chrome DevTools on any webpage
2. Go to the "Inspector Jake" tab
3. Click "Refresh" to scan for sessions
4. Connect to session "${state.sessionInfo.sessionName}"

Once connected, use the inspector tools to interact with the page.${chatInstructions}`,
    }
  );

  // Handle list tools request
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: toolDefs.map(({ name, description, inputSchema }) => ({
        name,
        description,
        inputSchema,
      })),
    };
  });

  // Handle tool calls — reads state at call time so set_session_name swaps are visible
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    return dispatchTool(name, args, state);
  });

  // Connect via stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Keep the server running
  log.info('MCP', 'MCP server started. Listening for tool calls via stdio.');
}
