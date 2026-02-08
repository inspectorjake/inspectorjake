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
import type { WsServerInstance } from './ws-server.js';
import { log } from './logger.js';
import { toolDefs, dispatchTool } from './tool-registry.js';

export interface SessionInfo {
  sessionName: string;
  port: number;
}

export async function createMcpServer(
  wsServer: WsServerInstance,
  sessionInfo: SessionInfo
): Promise<void> {
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

Session Name: ${sessionInfo.sessionName}
Port: ${sessionInfo.port}

To use this server:
1. Open Chrome DevTools on any webpage
2. Go to the "Inspector Jake" tab
3. Click "Refresh" to scan for sessions
4. Connect to session "${sessionInfo.sessionName}"

Once connected, use the inspector tools to interact with the page.`,
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

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    return dispatchTool(name, args, wsServer, sessionInfo);
  });

  // Connect via stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Keep the server running
  log.info('MCP', 'MCP server started. Listening for tool calls via stdio.');
}
