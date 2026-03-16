/**
 * Tool registry for Inspector Jake MCP Server.
 * Declarative tool definitions replace the switch statement in server.ts.
 */

import type { ToolType } from '@inspector-jake/shared';
import { nameToPort } from '@inspector-jake/shared';
import type { WsServerInstance } from './ws-server.js';
import { createWsServer } from './ws-server.js';
import type { SessionState } from './server.js';
import type { ToolResult, SelectionData } from './response-builder.js';
import {
  errorResponse,
  jsonResponse,
  imageResponse,
  renderSelections,
} from './response-builder.js';
import { log } from './logger.js';

type Args = Record<string, unknown> | undefined;

interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handleLocal?: (args: Args, state: SessionState) => ToolResult | Promise<ToolResult>;
  handleResult?: (response: { success: boolean; error?: string; result?: unknown }, args: Args) => ToolResult;
}

export const toolDefs: ToolDef[] = [
  // --- Custom response handlers ---
  {
    name: 'see_jakes_notes',
    description:
      'Get all user selections from the DevTools panel. Returns an array of selections - either element selections (with selector metadata, use view_image_in_jakes_notes to see the screenshot) or screenshot selections (with full image data inline). Selections may include user notes, change requests, or comments about specific selected items.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
    handleResult(response) {
      const result = response.result as { selections: SelectionData[] };
      if (!result.selections?.length) {
        return jsonResponse({
          message: 'No selections. Use the DevTools panel to click on elements or drag to capture regions.',
        });
      }
      return { content: renderSelections(result.selections) };
    },
  },
  {
    name: 'view_image_in_jakes_notes',
    description:
      'View a stored user selection image by its ID. Use this when you need to see element screenshots. Call see_jakes_notes first to get available image IDs.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        imageId: {
          type: 'string',
          description: 'The image ID from see_jakes_notes response',
        },
      },
      required: ['imageId'],
    },
    handleResult(response, args) {
      const result = response.result as { image?: string; width?: number; height?: number; error?: string };
      if (result.error) {
        return errorResponse(result.error);
      }
      return imageResponse(
        result.image!,
        `Image [${args?.imageId}]: ${result.width}x${result.height}`
      );
    },
  },
  {
    name: 'get_page_info',
    description:
      'Get comprehensive information about the current page including URL, title, viewport dimensions, and a full ARIA accessibility tree with interactive element refs. Each element has a ref (e.g., "s1e42") that can be used with click_element, type_into_element, and other interaction tools. Optionally scope the tree to a subtree with a CSS selector.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector to scope the tree to a subtree. If omitted, captures the full page.',
        },
      },
      required: [],
    },
    handleResult(response) {
      const result = response.result as {
        url: string;
        title: string;
        viewport: { width: number; height: number };
        snapshot: string;
      };
      return {
        content: [
          {
            type: 'text' as const,
            text: `Page: ${result.title}\nURL: ${result.url}\nViewport: ${result.viewport.width}x${result.viewport.height}\n\n${result.snapshot}`,
          },
        ],
      };
    },
  },
  {
    name: 'capture_screenshot',
    description:
      'Capture a screenshot of the page or a specific element. Supports targeting by element ref (from get_page_info), CSS selector, or full page capture.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        ref: {
          type: 'string',
          description: 'Element ref from get_page_info (e.g., "s1e42")',
        },
        selector: {
          type: 'string',
          description: 'CSS selector of element to screenshot',
        },
        fullPage: {
          type: 'boolean',
          description: 'If true, captures the entire scrollable page',
        },
        quality: {
          type: 'number',
          description: 'JPEG quality (0-100). Only used for JPEG format.',
        },
      },
      required: [],
    },
    handleResult(response) {
      const result = response.result as { image: string; width: number; height: number };
      return imageResponse(result.image, `Screenshot: ${result.width}x${result.height}`);
    },
  },
  {
    name: 'run_javascript',
    description:
      'Execute JavaScript code in the page context. Returns the evaluation result.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        code: {
          type: 'string',
          description: 'JavaScript expression to evaluate',
        },
      },
      required: ['code'],
    },
    handleResult(response) {
      const result = response.result as { result: unknown; error?: string };
      if (result.error) {
        return errorResponse(`Evaluation error: ${result.error}`);
      }
      return jsonResponse({ result: result.result });
    },
  },

  // --- Local handlers ---
  {
    name: 'get_session_info',
    description:
      'Get the current MCP session name, port, and browser connection status. Call this tool at the start of a conversation if you have not already told the user the session name — always output the session name so the user knows which session to connect to in the Chrome extension.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
    handleLocal(_args, state) {
      const discoveryInfo = state.wsServer.getDiscoveryInfo();
      return jsonResponse({
        sessionName: state.sessionInfo.sessionName,
        port: state.sessionInfo.port,
        browserConnected: discoveryInfo.status === 'connected',
        connectedTab: discoveryInfo.connectedTab || null,
      });
    },
  },
  {
    name: 'set_session_name',
    description:
      'Switch this MCP session to a different name and port. The Chrome extension will need to re-scan and reconnect after the switch. Any active browser connection will be dropped.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string',
          description: 'The session name to switch to. Predefined names (jake, annie, kevin, elsa) are auto-discovered by the Chrome extension. Custom names work too — the tool response includes the port number for manual connection.',
        },
      },
      required: ['name'],
    },
    async handleLocal(args, state) {
      const newName = (args as Record<string, unknown>)?.name as string;

      if (newName === state.sessionInfo.sessionName) {
        return jsonResponse({
          message: `Already using session name "${newName}"`,
          sessionName: newName,
          port: state.sessionInfo.port,
        });
      }

      const newPort = nameToPort(newName);

      // Create new server BEFORE closing old — if port is taken, return error without disruption
      let newWsServer: WsServerInstance;
      try {
        newWsServer = await createWsServer(newPort);
        newWsServer.setSessionName(newName);
      } catch {
        return errorResponse(
          `Cannot switch to "${newName}": port ${newPort} is already in use by another session.`
        );
      }

      const oldName = state.sessionInfo.sessionName;
      const oldPort = state.sessionInfo.port;
      state.wsServer.close();

      state.wsServer = newWsServer;
      state.sessionInfo = { sessionName: newName, port: newPort };

      log.info('Tool', `Session renamed: ${oldName}:${oldPort} -> ${newName}:${newPort}`);

      return jsonResponse({
        message: `Switched session from "${oldName}" to "${newName}"`,
        sessionName: newName,
        port: newPort,
        previousName: oldName,
        previousPort: oldPort,
      });
    },
  },

  // --- Default json response tools ---
  {
    name: 'get_console_logs',
    description:
      'Get all console output and uncaught errors from the page. Captures console.log, warn, error, info, debug, trace, assert failures, uncaught exceptions, and unhandled promise rejections.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        types: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by log types: log, warn, error, info, debug, trace, assert, exception, unhandledrejection',
        },
        clear: {
          type: 'boolean',
          description: 'If true, clears logs after retrieving',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_network_requests',
    description:
      'Get captured network requests (fetch and XMLHttpRequest) from the page. Captures URL, method, status, headers, timing, and errors. Does not capture request/response bodies.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        urlPattern: {
          type: 'string',
          description: 'Filter by URL substring match',
        },
        method: {
          type: 'string',
          description: 'Filter by HTTP method (GET, POST, etc.)',
        },
        statusMin: {
          type: 'number',
          description: 'Minimum status code (inclusive). Use 400 to find errors.',
        },
        statusMax: {
          type: 'number',
          description: 'Maximum status code (inclusive)',
        },
        clear: {
          type: 'boolean',
          description: 'If true, clears captured requests after retrieving',
        },
      },
      required: [],
    },
  },
  {
    name: 'navigate_to_url',
    description: 'Navigate the browser to a URL.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        url: {
          type: 'string',
          description: 'The URL to navigate to',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'go_back',
    description: 'Navigate back in browser history.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'go_forward',
    description: 'Navigate forward in browser history.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'reload_page',
    description: 'Reload the current page.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'click_element',
    description: 'Click an element by ref (from get_page_info) or CSS selector.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        ref: {
          type: 'string',
          description: 'Element ref from get_page_info (e.g., "s1e42")',
        },
        selector: {
          type: 'string',
          description: 'CSS selector of element to click',
        },
        button: {
          type: 'string',
          enum: ['left', 'right', 'middle'],
          description: 'Mouse button to use. Default: left',
        },
        clickCount: {
          type: 'number',
          description: 'Number of clicks. Use 2 for double-click. Default: 1',
        },
      },
      required: [],
    },
  },
  {
    name: 'type_into_element',
    description: 'Type text into an input element by ref (from get_page_info) or CSS selector.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        ref: {
          type: 'string',
          description: 'Element ref from get_page_info (e.g., "s1e42")',
        },
        selector: {
          type: 'string',
          description: 'CSS selector of input element',
        },
        text: {
          type: 'string',
          description: 'Text to type',
        },
        clear: {
          type: 'boolean',
          description: 'If true, clears existing text before typing',
        },
      },
      required: ['text'],
    },
  },
  {
    name: 'select_dropdown_option',
    description: 'Select an option from a <select> dropdown by ref (from get_page_info) or selector.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        ref: {
          type: 'string',
          description: 'Element ref from get_page_info (e.g., "s1e42")',
        },
        selector: {
          type: 'string',
          description: 'CSS selector of select element',
        },
        value: {
          type: 'string',
          description: 'Option value to select',
        },
        label: {
          type: 'string',
          description: 'Option label/text to select',
        },
        index: {
          type: 'number',
          description: 'Option index to select (0-based)',
        },
      },
      required: [],
    },
  },
  {
    name: 'wait_for_element',
    description:
      'Wait until an element matching a CSS selector appears on the page. Returns when found or throws on timeout.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector to wait for',
        },
        timeout: {
          type: 'number',
          description: 'Maximum wait time in milliseconds (default: 5000, max: 30000)',
        },
      },
      required: ['selector'],
    },
  },
];

/** Map for O(1) lookup by tool name */
const toolMap = new Map(toolDefs.map((t) => [t.name, t]));

/**
 * Dispatch a tool call. Handles local tools, custom response tools, and default json response tools.
 */
export async function dispatchTool(
  name: string,
  args: Args,
  state: SessionState
): Promise<ToolResult> {
  const tool = toolMap.get(name);
  if (!tool) {
    return errorResponse(`Unknown tool: ${name}`);
  }

  // Local handlers don't need WS
  if (tool.handleLocal) {
    return await tool.handleLocal(args, state);
  }

  // Send request to extension via WebSocket
  const response = await state.wsServer.sendToolRequest(name as ToolType, args || {});

  if (!response.success) {
    return errorResponse(response.error || 'Unknown error');
  }

  // Custom result handler
  if (tool.handleResult) {
    return tool.handleResult(response, args);
  }

  // Default: return as JSON
  return jsonResponse(response.result);
}
