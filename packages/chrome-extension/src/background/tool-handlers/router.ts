/**
 * Tool request router — maps MCP tool names to handler functions.
 * Replaces the 15-case switch statement with a registry pattern.
 */

import type { ToolRequest, ToolResponse } from '@inspector-jake/shared';
import { handleGetSelections, handleViewImage, handleCombinedPageInfo } from './inspection-handlers.js';
import { handleBrowserScreenshot, captureElementScreenshot } from './screenshot-handlers.js';
import {
  handleBrowserClick,
  handleBrowserType,
  handleBrowserSelectOption,
  handleBrowserNavigate,
  handleBrowserGoBack,
  handleBrowserGoForward,
  handleBrowserReload,
  handleBrowserEvaluate,
  handleBrowserGetConsoleLogs,
  handleWaitForElement,
} from './automation-handlers.js';

type ToolHandler = (tabId: number | null, payload: any) => Promise<any>;

const TOOL_REGISTRY: Record<string, ToolHandler> = {
  see_jakes_notes: () => handleGetSelections(),
  view_image_in_jakes_notes: (_tabId, payload) => Promise.resolve(handleViewImage(payload)),
  get_page_info: (tabId, payload) => handleCombinedPageInfo(tabId, payload),
  capture_screenshot: (tabId, payload) => handleBrowserScreenshot(tabId, payload),
  run_javascript: (tabId, payload) => handleBrowserEvaluate(tabId, payload),
  get_console_logs: (tabId, payload) => handleBrowserGetConsoleLogs(tabId, payload),
  navigate_to_url: (tabId, payload) => handleBrowserNavigate(tabId, payload),
  go_back: (tabId) => handleBrowserGoBack(tabId),
  go_forward: (tabId) => handleBrowserGoForward(tabId),
  reload_page: (tabId) => handleBrowserReload(tabId),
  click_element: (tabId, payload) => handleBrowserClick(tabId, payload),
  type_into_element: (tabId, payload) => handleBrowserType(tabId, payload),
  select_dropdown_option: (tabId, payload) => handleBrowserSelectOption(tabId, payload),
  wait_for_element: (tabId, payload) => handleWaitForElement(tabId, payload),
};

/**
 * Handle incoming tool request from MCP server.
 */
export async function handleToolRequest(
  request: ToolRequest,
  tabId: number | null
): Promise<ToolResponse> {
  const { id, type, payload } = request;

  const handler = TOOL_REGISTRY[type];
  if (!handler) {
    return { id, success: false, error: `Unknown tool type: ${type}` };
  }

  try {
    const result = await handler(tabId, payload);
    return { id, success: true, result };
  } catch (err) {
    return {
      id,
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
