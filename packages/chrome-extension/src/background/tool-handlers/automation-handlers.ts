/**
 * Browser automation tool handlers extracted from tool-handlers.ts.
 *
 * Handles click, type, select, navigate, evaluate, console logs,
 * and wait-for-element operations. Ref-resolution executeScript
 * calls use shared page-script functions from resolve-ref.ts.
 */

import type {
  BrowserClickRequest,
  BrowserTypeRequest,
  BrowserSelectOptionRequest,
  BrowserNavigateRequest,
  BrowserEvaluateRequest,
  BrowserGetConsoleLogsRequest,
  BrowserGetNetworkRequestsRequest,
  BrowserActionResponse,
  BrowserEvaluateResponse,
  BrowserConsoleLogsResponse,
  BrowserNetworkRequestsResponse,
  WaitForElementRequest,
  WaitForElementResponse,
} from '@inspector-jake/shared';

import { attachDebugger, cdpClick, cdpType, cdpEvaluate } from '../cdp.js';

import {
  resolveRefAndGetCenter,
  resolveRefAndFocus,
  resolveRefAndSetValue,
  resolveRefAndClick,
  resolveRefAndSelectOption,
} from './page-scripts/resolve-ref.js';

// ---------------------------------------------------------------------------
// Navigation handlers
// ---------------------------------------------------------------------------

/**
 * Handle navigate_to_url tool.
 */
export async function handleBrowserNavigate(
  tabId: number | null,
  payload: BrowserNavigateRequest
): Promise<BrowserActionResponse> {
  if (!tabId) {
    throw new Error('No tab connected');
  }

  await chrome.tabs.update(tabId, { url: payload.url });
  return { success: true, message: `Navigated to ${payload.url}` };
}

/**
 * Handle go_back tool.
 */
export async function handleBrowserGoBack(
  tabId: number | null
): Promise<BrowserActionResponse> {
  if (!tabId) {
    throw new Error('No tab connected');
  }

  await chrome.tabs.goBack(tabId);
  return { success: true, message: 'Navigated back' };
}

/**
 * Handle go_forward tool.
 */
export async function handleBrowserGoForward(
  tabId: number | null
): Promise<BrowserActionResponse> {
  if (!tabId) {
    throw new Error('No tab connected');
  }

  await chrome.tabs.goForward(tabId);
  return { success: true, message: 'Navigated forward' };
}

/**
 * Handle reload_page tool.
 */
export async function handleBrowserReload(
  tabId: number | null
): Promise<BrowserActionResponse> {
  if (!tabId) {
    throw new Error('No tab connected');
  }

  await chrome.tabs.reload(tabId);
  return { success: true, message: 'Page reloaded' };
}

// ---------------------------------------------------------------------------
// Evaluate / Console handlers
// ---------------------------------------------------------------------------

/**
 * Handle run_javascript tool.
 * Executes JavaScript in the page context.
 * Uses CDP Runtime.evaluate first (bypasses CSP), falls back to chrome.scripting.
 */
export async function handleBrowserEvaluate(
  tabId: number | null,
  payload: BrowserEvaluateRequest
): Promise<BrowserEvaluateResponse> {
  if (!tabId) {
    throw new Error('No tab connected');
  }

  // Try CDP Runtime.evaluate first — bypasses Content Security Policy restrictions
  try {
    await attachDebugger(tabId);
    const value = await cdpEvaluate(tabId, payload.code);
    return { result: value };
  } catch {
    // CDP unavailable (e.g. DevTools open, debugger can't attach) — fall back to scripting
  }

  // Fallback: chrome.scripting.executeScript (subject to page CSP)
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: (code: string) => {
      try {
        const fn = new Function(`return (${code})`);
        const value = fn();
        return { success: true, value };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
    args: [payload.code],
  });

  if (!result?.result) {
    throw new Error('Failed to evaluate script');
  }

  if (!result.result.success) {
    return { result: null, error: result.result.error };
  }

  return { result: result.result.value };
}

/**
 * Handle get_console_logs tool.
 * Returns captured console logs.
 */
export async function handleBrowserGetConsoleLogs(
  tabId: number | null,
  payload: BrowserGetConsoleLogsRequest
): Promise<BrowserConsoleLogsResponse> {
  if (!tabId) {
    throw new Error('No tab connected');
  }

  // Get logs from content script (injected listener)
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: (types: string[] | undefined, clear: boolean | undefined) => {
      const logs = (window as any).__consoleLogs || [];
      let filtered = logs;

      if (types && types.length > 0) {
        filtered = logs.filter((l: any) => types.includes(l.type));
      }

      if (clear) {
        (window as any).__consoleLogs = [];
      }

      return filtered;
    },
    args: [payload.types ?? null, payload.clear ?? false],
  });

  return { logs: result?.result || [] };
}

/**
 * Handle get_network_requests tool.
 * Returns captured network requests (fetch and XHR).
 */
export async function handleBrowserGetNetworkRequests(
  tabId: number | null,
  payload: BrowserGetNetworkRequestsRequest
): Promise<BrowserNetworkRequestsResponse> {
  if (!tabId) {
    throw new Error('No tab connected');
  }

  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: (
      urlPattern: string | null,
      method: string | null,
      statusMin: number | null,
      statusMax: number | null,
      clear: boolean
    ) => {
      const requests = (window as any).__networkRequests || [];
      let filtered = requests;

      if (urlPattern) {
        filtered = filtered.filter((r: any) => r.url.includes(urlPattern));
      }
      if (method) {
        filtered = filtered.filter(
          (r: any) => r.method.toUpperCase() === method.toUpperCase()
        );
      }
      if (statusMin != null) {
        filtered = filtered.filter((r: any) => r.status >= statusMin);
      }
      if (statusMax != null) {
        filtered = filtered.filter((r: any) => r.status <= statusMax);
      }

      if (clear) {
        (window as any).__networkRequests = [];
      }

      return filtered;
    },
    args: [
      payload.urlPattern ?? null,
      payload.method ?? null,
      payload.statusMin ?? null,
      payload.statusMax ?? null,
      payload.clear ?? false,
    ],
  });

  return { requests: result?.result || [] };
}

// ---------------------------------------------------------------------------
// Click handler
// ---------------------------------------------------------------------------

/**
 * Handle click_element tool.
 * Clicks an element by ref or selector.
 */
export async function handleBrowserClick(
  tabId: number | null,
  payload: BrowserClickRequest
): Promise<BrowserActionResponse> {
  if (!tabId) {
    throw new Error('No tab connected');
  }

  // Get element coordinates using shared page-script
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: resolveRefAndGetCenter,
    args: [payload.ref ?? null, payload.selector ?? null],
  });

  if (!result?.result || 'error' in result.result) {
    throw new Error(
      (result?.result as { error: string } | undefined)?.error || 'Failed to locate element'
    );
  }

  const { x, y } = result.result as { x: number; y: number };

  // Try CDP click first, fall back to synthetic click
  try {
    await attachDebugger(tabId);
    await cdpClick(tabId, x, y, payload.button || 'left', payload.clickCount || 1);
    return { success: true, message: `Clicked at (${Math.round(x)}, ${Math.round(y)})` };
  } catch {
    // Fall back to synthetic click using shared page-script
    await chrome.scripting.executeScript({
      target: { tabId },
      func: resolveRefAndClick,
      args: [
        payload.ref ?? null,
        payload.selector ?? null,
        payload.button || 'left',
        payload.clickCount || 1,
      ],
    });

    return { success: true, message: 'Clicked element (synthetic)' };
  }
}

// ---------------------------------------------------------------------------
// Type handler
// ---------------------------------------------------------------------------

/**
 * Handle type_into_element tool.
 * Types text into an input element.
 */
export async function handleBrowserType(
  tabId: number | null,
  payload: BrowserTypeRequest
): Promise<BrowserActionResponse> {
  if (!tabId) {
    throw new Error('No tab connected');
  }

  // Focus the element and optionally clear it using shared page-script
  await chrome.scripting.executeScript({
    target: { tabId },
    func: resolveRefAndFocus,
    args: [payload.ref ?? null, payload.selector ?? null, payload.clear ?? false],
  });

  // Type using CDP if possible, otherwise synthetic input
  try {
    await attachDebugger(tabId);
    await cdpType(tabId, payload.text);
    return {
      success: true,
      message: `Typed "${payload.text.slice(0, 20)}${payload.text.length > 20 ? '...' : ''}"`,
    };
  } catch {
    // Fall back to direct value setting using shared page-script
    await chrome.scripting.executeScript({
      target: { tabId },
      func: resolveRefAndSetValue,
      args: [payload.ref ?? null, payload.selector ?? null, payload.text],
    });

    return { success: true, message: 'Typed text (synthetic)' };
  }
}

// ---------------------------------------------------------------------------
// Select option handler
// ---------------------------------------------------------------------------

/**
 * Handle select_dropdown_option tool.
 * Selects an option in a <select> element.
 */
export async function handleBrowserSelectOption(
  tabId: number | null,
  payload: BrowserSelectOptionRequest
): Promise<BrowserActionResponse> {
  if (!tabId) {
    throw new Error('No tab connected');
  }

  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: resolveRefAndSelectOption,
    args: [
      payload.ref ?? null,
      payload.selector ?? null,
      payload.value ?? null,
      payload.label ?? null,
      payload.index ?? null,
    ],
  });

  if (!result?.result || 'error' in result.result) {
    throw new Error(
      (result?.result as { error: string } | undefined)?.error || 'Failed to select option'
    );
  }

  const selected = result.result as { success: true; selectedValue: string; selectedLabel: string };
  return { success: true, message: `Selected option: ${selected.selectedLabel}` };
}

// ---------------------------------------------------------------------------
// Wait for element handler
// ---------------------------------------------------------------------------

/**
 * Handle wait_for_element tool.
 * Waits until a CSS selector matches an element on the page.
 * Uses MutationObserver + immediate check for reliability.
 */
export async function handleWaitForElement(
  tabId: number | null,
  payload: WaitForElementRequest
): Promise<WaitForElementResponse> {
  if (!tabId) throw new Error('No tab connected');

  const timeout = Math.min(payload.timeout ?? 5000, 30000);

  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: (selector: string, timeoutMs: number) => {
      return new Promise<{ found: boolean; selector: string; elapsed: number }>(
        (resolve, reject) => {
          const start = Date.now();

          // Check immediately
          if (document.querySelector(selector)) {
            return resolve({ found: true, selector, elapsed: 0 });
          }

          // Set up observer
          const observer = new MutationObserver(() => {
            if (document.querySelector(selector)) {
              observer.disconnect();
              resolve({ found: true, selector, elapsed: Date.now() - start });
            }
          });

          observer.observe(document.body, { childList: true, subtree: true });

          // Timeout fallback
          setTimeout(() => {
            observer.disconnect();
            reject(new Error(`Timeout: element "${selector}" not found within ${timeoutMs}ms`));
          }, timeoutMs);
        }
      );
    },
    args: [payload.selector, timeout],
  });

  if (!result?.result) throw new Error('Failed to wait for element');
  return result.result as WaitForElementResponse;
}
