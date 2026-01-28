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
import {
  errorResponse,
  jsonResponse,
  imageResponse,
  renderSelections,
  type ContentItem,
  type SelectionData,
} from './response-builder.js';

export interface SessionInfo {
  sessionName: string;
  port: number;
}

const TOOLS = [
  {
    name: 'inspector_get_selected_element',
    description:
      'Get the element currently selected in Chrome DevTools Elements panel. Returns element info including tag, id, classes, attributes, and bounding rect. Also includes any user selections (elements and screenshots). Useful for understanding what the user is looking at.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'inspector_get_selections',
    description:
      'Get all user selections from the DevTools panel. Returns an array of selections - either element selections (with selector metadata, use inspector_view_image to see the screenshot) or screenshot selections (with full image data inline).',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'inspector_view_image',
    description:
      'View a stored image by its ID. Use this when you need to see element screenshots. Call inspector_get_selections first to get available image IDs.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        imageId: {
          type: 'string',
          description: 'The image ID from inspector_get_selections response',
        },
      },
      required: ['imageId'],
    },
  },
  {
    name: 'inspector_snapshot',
    description:
      'Get an ARIA accessibility tree snapshot of the current page. Returns a structured representation of the page content that can be used to understand page structure and find elements.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'inspector_screenshot',
    description:
      'Capture a screenshot of the page or a specific element. Returns base64-encoded PNG image.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector of element to screenshot. If omitted, captures the viewport.',
        },
        fullPage: {
          type: 'boolean',
          description: 'If true, captures the entire scrollable page. Ignored if selector is provided.',
        },
      },
      required: [],
    },
  },
  {
    name: 'inspector_get_page_info',
    description:
      'Get basic information about the current page including URL, title, and viewport dimensions.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'inspector_get_session_info',
    description:
      "Get information about the current MCP session including session name, port, and browser connection status. Call this to find out which session to connect to in the Jake MCP Chrome extension.",
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  // Browser automation tools
  {
    name: 'interactive_context',
    description:
      'Get accessibility tree with element refs for interaction. Each element has a ref (e.g., "s1e42") that can be used with browser_click, browser_type, etc. Also includes user selections from DevTools panel.',
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
  },
  {
    name: 'browser_screenshot',
    description:
      'Enhanced screenshot with element ref support. Can screenshot by ref from interactive_context, CSS selector, or full page.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        ref: {
          type: 'string',
          description: 'Element ref from interactive_context (e.g., "s1e42")',
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
  },
  {
    name: 'browser_evaluate',
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
  },
  {
    name: 'browser_get_console_logs',
    description:
      'Get console log messages from the page.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        types: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by log types: log, warn, error, info',
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
    name: 'browser_navigate',
    description:
      'Navigate the browser to a URL.',
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
    name: 'browser_go_back',
    description:
      'Navigate back in browser history.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'browser_go_forward',
    description:
      'Navigate forward in browser history.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'browser_reload',
    description:
      'Reload the current page.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'browser_click',
    description:
      'Click an element by ref (from interactive_context) or CSS selector.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        ref: {
          type: 'string',
          description: 'Element ref from interactive_context (e.g., "s1e42")',
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
    name: 'browser_type',
    description:
      'Type text into an input element by ref or CSS selector.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        ref: {
          type: 'string',
          description: 'Element ref from interactive_context (e.g., "s1e42")',
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
    name: 'browser_select_option',
    description:
      'Select an option from a <select> dropdown by ref or selector.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        ref: {
          type: 'string',
          description: 'Element ref from interactive_context (e.g., "s1e42")',
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
];

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
    return { tools: TOOLS };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'inspector_get_selected_element': {
        const response = await wsServer.sendToolRequest(
          'inspector_get_selected_element',
          {}
        );

        if (!response.success) {
          return errorResponse(response.error || 'Unknown error');
        }

        const result = response.result as {
          selected: boolean;
          element?: any;
          reason?: string;
          selections?: SelectionData[];
        };

        const content: ContentItem[] = [
          {
            type: 'text',
            text: JSON.stringify({ selected: result.selected, element: result.element, reason: result.reason }, null, 2),
          },
        ];

        // Add selections using shared utility
        content.push(...renderSelections(result.selections));

        return { content };
      }

      case 'inspector_get_selections': {
        const response = await wsServer.sendToolRequest(
          'inspector_get_selections',
          {}
        );

        if (!response.success) {
          return errorResponse(response.error || 'Unknown error');
        }

        const result = response.result as { selections: SelectionData[] };

        if (!result.selections?.length) {
          return jsonResponse({
            message: 'No selections. Use the DevTools panel to click on elements or drag to capture regions.',
          });
        }

        const content = renderSelections(result.selections);
        return { content };
      }

      case 'inspector_view_image': {
        const imageId = args?.imageId as string;
        if (!imageId) {
          return errorResponse('imageId is required');
        }

        const response = await wsServer.sendToolRequest(
          'inspector_view_image',
          { imageId }
        );

        if (!response.success) {
          return errorResponse(response.error || 'Unknown error');
        }

        const result = response.result as { image?: string; width?: number; height?: number; error?: string };

        if (result.error) {
          return errorResponse(result.error);
        }

        return imageResponse(
          result.image!,
          `Image [${imageId}]: ${result.width}x${result.height}`
        );
      }

      case 'inspector_snapshot': {
        const response = await wsServer.sendToolRequest(
          'inspector_snapshot',
          {}
        );

        if (!response.success) {
          return errorResponse(response.error || 'Unknown error');
        }

        const result = response.result as {
          snapshot: string;
          selections?: SelectionData[];
        };

        const content: ContentItem[] = [
          {
            type: 'text',
            text: JSON.stringify({ snapshot: result.snapshot }, null, 2),
          },
        ];

        // Add selections using shared utility
        content.push(...renderSelections(result.selections));

        return { content };
      }

      case 'inspector_screenshot': {
        const payload = {
          selector: args?.selector as string | undefined,
          fullPage: args?.fullPage as boolean | undefined,
        };

        const response = await wsServer.sendToolRequest(
          'inspector_screenshot',
          payload
        );

        if (!response.success) {
          return errorResponse(response.error || 'Unknown error');
        }

        const result = response.result as { image: string; width: number; height: number };

        return imageResponse(
          result.image,
          `Screenshot captured: ${result.width}x${result.height}`
        );
      }

      case 'inspector_get_page_info': {
        const response = await wsServer.sendToolRequest(
          'inspector_get_page_info',
          {}
        );

        if (!response.success) {
          return errorResponse(response.error || 'Unknown error');
        }

        return jsonResponse(response.result);
      }

      case 'inspector_get_session_info': {
        const discoveryInfo = wsServer.getDiscoveryInfo();
        return jsonResponse({
          sessionName: sessionInfo.sessionName,
          port: sessionInfo.port,
          browserConnected: discoveryInfo.status === 'connected',
          connectedTab: discoveryInfo.connectedTab || null,
        });
      }

      // Browser automation tools
      case 'interactive_context': {
        const response = await wsServer.sendToolRequest('interactive_context', {
          selector: args?.selector as string | undefined,
        });

        if (!response.success) {
          return errorResponse(response.error || 'Unknown error');
        }

        const result = response.result as {
          url: string;
          title: string;
          snapshot: string;
          selections?: SelectionData[];
        };

        const content: ContentItem[] = [
          {
            type: 'text',
            text: `Page: ${result.title}\nURL: ${result.url}\n\n${result.snapshot}`,
          },
        ];

        // Add selections using shared utility
        content.push(...renderSelections(result.selections));

        return { content };
      }

      case 'browser_screenshot': {
        const response = await wsServer.sendToolRequest('browser_screenshot', {
          ref: args?.ref as string | undefined,
          selector: args?.selector as string | undefined,
          fullPage: args?.fullPage as boolean | undefined,
          quality: args?.quality as number | undefined,
        });

        if (!response.success) {
          return errorResponse(response.error || 'Unknown error');
        }

        const result = response.result as { image: string; width: number; height: number };
        return imageResponse(result.image, `Screenshot: ${result.width}x${result.height}`);
      }

      case 'browser_evaluate': {
        const code = args?.code as string;
        if (!code) {
          return errorResponse('code is required');
        }

        const response = await wsServer.sendToolRequest('browser_evaluate', { code });

        if (!response.success) {
          return errorResponse(response.error || 'Unknown error');
        }

        const result = response.result as { result: unknown; error?: string };
        if (result.error) {
          return errorResponse(`Evaluation error: ${result.error}`);
        }

        return jsonResponse({ result: result.result });
      }

      case 'browser_get_console_logs': {
        const response = await wsServer.sendToolRequest('browser_get_console_logs', {
          types: args?.types as string[] | undefined,
          clear: args?.clear as boolean | undefined,
        });

        if (!response.success) {
          return errorResponse(response.error || 'Unknown error');
        }

        return jsonResponse(response.result);
      }

      case 'browser_navigate': {
        const url = args?.url as string;
        if (!url) {
          return errorResponse('url is required');
        }

        const response = await wsServer.sendToolRequest('browser_navigate', { url });

        if (!response.success) {
          return errorResponse(response.error || 'Unknown error');
        }

        return jsonResponse(response.result);
      }

      case 'browser_go_back': {
        const response = await wsServer.sendToolRequest('browser_go_back', {});

        if (!response.success) {
          return errorResponse(response.error || 'Unknown error');
        }

        return jsonResponse(response.result);
      }

      case 'browser_go_forward': {
        const response = await wsServer.sendToolRequest('browser_go_forward', {});

        if (!response.success) {
          return errorResponse(response.error || 'Unknown error');
        }

        return jsonResponse(response.result);
      }

      case 'browser_reload': {
        const response = await wsServer.sendToolRequest('browser_reload', {});

        if (!response.success) {
          return errorResponse(response.error || 'Unknown error');
        }

        return jsonResponse(response.result);
      }

      case 'browser_click': {
        const response = await wsServer.sendToolRequest('browser_click', {
          ref: args?.ref as string | undefined,
          selector: args?.selector as string | undefined,
          button: args?.button as string | undefined,
          clickCount: args?.clickCount as number | undefined,
        });

        if (!response.success) {
          return errorResponse(response.error || 'Unknown error');
        }

        return jsonResponse(response.result);
      }

      case 'browser_type': {
        const text = args?.text as string;
        if (!text) {
          return errorResponse('text is required');
        }

        const response = await wsServer.sendToolRequest('browser_type', {
          ref: args?.ref as string | undefined,
          selector: args?.selector as string | undefined,
          text,
          clear: args?.clear as boolean | undefined,
        });

        if (!response.success) {
          return errorResponse(response.error || 'Unknown error');
        }

        return jsonResponse(response.result);
      }

      case 'browser_select_option': {
        const response = await wsServer.sendToolRequest('browser_select_option', {
          ref: args?.ref as string | undefined,
          selector: args?.selector as string | undefined,
          value: args?.value as string | undefined,
          label: args?.label as string | undefined,
          index: args?.index as number | undefined,
        });

        if (!response.success) {
          return errorResponse(response.error || 'Unknown error');
        }

        return jsonResponse(response.result);
      }

      default:
        return errorResponse(`Unknown tool: ${name}`);
    }
  });

  // Connect via stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Keep the server running
  log.info('MCP', 'MCP server started. Listening for tool calls via stdio.');
}
