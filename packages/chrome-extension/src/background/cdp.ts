/**
 * Chrome DevTools Protocol helpers for browser automation.
 *
 * Provides reliable click, type, and other input operations using CDP's
 * Input domain instead of synthetic DOM events.
 */

// Track debugger attachments per tab
const attachedTabs = new Set<number>();

/**
 * Attach the Chrome debugger to a tab.
 * Multiple calls are idempotent - only attaches once per tab.
 */
export async function attachDebugger(tabId: number): Promise<void> {
  if (attachedTabs.has(tabId)) {
    return;
  }

  try {
    await chrome.debugger.attach({ tabId }, '1.3');
    attachedTabs.add(tabId);
    console.log(`[CDP] Attached debugger to tab ${tabId}`);
  } catch (err) {
    // May already be attached (e.g., DevTools is open)
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('Another debugger is already attached')) {
      // Can't attach when DevTools is open, but we can still use scripting
      console.log(`[CDP] DevTools already attached to tab ${tabId}, using scripting fallback`);
      return;
    }
    throw err;
  }
}

/**
 * Detach the Chrome debugger from a tab.
 */
export async function detachDebugger(tabId: number): Promise<void> {
  if (!attachedTabs.has(tabId)) {
    return;
  }

  try {
    await chrome.debugger.detach({ tabId });
    attachedTabs.delete(tabId);
    console.log(`[CDP] Detached debugger from tab ${tabId}`);
  } catch (err) {
    // Ignore errors if already detached
    attachedTabs.delete(tabId);
  }
}

/**
 * Check if debugger is attached to a tab.
 */
export function isDebuggerAttached(tabId: number): boolean {
  return attachedTabs.has(tabId);
}

/**
 * Send a CDP command to a tab.
 */
async function sendCommand<T = unknown>(
  tabId: number,
  method: string,
  params?: object
): Promise<T> {
  if (!attachedTabs.has(tabId)) {
    throw new Error('Debugger not attached');
  }

  return chrome.debugger.sendCommand({ tabId }, method, params) as Promise<T>;
}

/**
 * Dispatch a mouse event via CDP.
 */
export async function dispatchMouseEvent(
  tabId: number,
  type: 'mousePressed' | 'mouseReleased' | 'mouseMoved',
  x: number,
  y: number,
  button: 'left' | 'right' | 'middle' = 'left',
  clickCount: number = 1
): Promise<void> {
  const buttonMap: Record<string, 'left' | 'right' | 'middle'> = {
    left: 'left',
    right: 'right',
    middle: 'middle',
  };

  await sendCommand(tabId, 'Input.dispatchMouseEvent', {
    type,
    x,
    y,
    button: buttonMap[button] || 'left',
    clickCount,
  });
}

/**
 * Perform a click at coordinates via CDP.
 */
export async function cdpClick(
  tabId: number,
  x: number,
  y: number,
  button: 'left' | 'right' | 'middle' = 'left',
  clickCount: number = 1
): Promise<void> {
  // Move to position
  await dispatchMouseEvent(tabId, 'mouseMoved', x, y);

  // Press and release
  await dispatchMouseEvent(tabId, 'mousePressed', x, y, button, clickCount);
  await dispatchMouseEvent(tabId, 'mouseReleased', x, y, button, clickCount);
}

/**
 * Dispatch a key event via CDP.
 */
export async function dispatchKeyEvent(
  tabId: number,
  type: 'keyDown' | 'keyUp' | 'char',
  key: string,
  text?: string
): Promise<void> {
  const params: Record<string, unknown> = {
    type,
    key,
  };

  // Add text for char events
  if (type === 'char' && text) {
    params.text = text;
  }

  // Add key code for special keys
  const keyCodes: Record<string, number> = {
    Enter: 13,
    Tab: 9,
    Escape: 27,
    Backspace: 8,
    Delete: 46,
    ArrowUp: 38,
    ArrowDown: 40,
    ArrowLeft: 37,
    ArrowRight: 39,
  };

  if (keyCodes[key]) {
    params.keyCode = keyCodes[key];
    params.code = key;
  }

  await sendCommand(tabId, 'Input.dispatchKeyEvent', params);
}

/**
 * Type text character by character via CDP.
 */
export async function cdpType(tabId: number, text: string): Promise<void> {
  for (const char of text) {
    // For regular characters, use char event
    await dispatchKeyEvent(tabId, 'char', char, char);

    // Small delay between characters for realism
    await sleep(10);
  }
}

/**
 * Press a special key via CDP.
 */
export async function cdpPressKey(tabId: number, key: string): Promise<void> {
  await dispatchKeyEvent(tabId, 'keyDown', key);
  await dispatchKeyEvent(tabId, 'keyUp', key);
}

/**
 * Evaluate JavaScript expression via CDP.
 */
export async function cdpEvaluate<T = unknown>(
  tabId: number,
  expression: string
): Promise<T> {
  const result = await sendCommand<{
    result: { type: string; value: T; description?: string };
    exceptionDetails?: { text: string };
  }>(tabId, 'Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });

  if (result.exceptionDetails) {
    throw new Error(`Evaluation failed: ${result.exceptionDetails.text}`);
  }

  return result.result.value;
}

/**
 * Scroll to coordinates via CDP.
 */
export async function cdpScrollTo(
  tabId: number,
  x: number,
  y: number
): Promise<void> {
  // Use wheel event for smooth scrolling
  await sendCommand(tabId, 'Input.dispatchMouseEvent', {
    type: 'mouseWheel',
    x: 100,
    y: 100,
    deltaX: x,
    deltaY: y,
  });
}

/**
 * Get console log messages via CDP.
 */
export async function enableConsoleCapture(tabId: number): Promise<void> {
  await sendCommand(tabId, 'Console.enable');
  await sendCommand(tabId, 'Runtime.enable');
}

/**
 * Take a screenshot via CDP.
 */
export async function cdpScreenshot(
  tabId: number,
  options?: {
    format?: 'jpeg' | 'png' | 'webp';
    quality?: number;
    clip?: { x: number; y: number; width: number; height: number; scale: number };
    captureBeyondViewport?: boolean;
  }
): Promise<string> {
  const result = await sendCommand<{ data: string }>(
    tabId,
    'Page.captureScreenshot',
    {
      format: options?.format || 'png',
      quality: options?.quality,
      clip: options?.clip,
      captureBeyondViewport: options?.captureBeyondViewport ?? false,
    }
  );

  return `data:image/${options?.format || 'png'};base64,${result.data}`;
}

/**
 * Navigate the page via CDP.
 */
export async function cdpNavigate(tabId: number, url: string): Promise<void> {
  await sendCommand(tabId, 'Page.navigate', { url });
}

/**
 * Go back in browser history via CDP.
 */
export async function cdpGoBack(tabId: number): Promise<void> {
  const history = await sendCommand<{ currentIndex: number; entries: unknown[] }>(
    tabId,
    'Page.getNavigationHistory'
  );

  if (history.currentIndex > 0) {
    const entry = history.entries[history.currentIndex - 1] as { id: number };
    await sendCommand(tabId, 'Page.navigateToHistoryEntry', { entryId: entry.id });
  }
}

/**
 * Go forward in browser history via CDP.
 */
export async function cdpGoForward(tabId: number): Promise<void> {
  const history = await sendCommand<{ currentIndex: number; entries: unknown[] }>(
    tabId,
    'Page.getNavigationHistory'
  );

  if (history.currentIndex < history.entries.length - 1) {
    const entry = history.entries[history.currentIndex + 1] as { id: number };
    await sendCommand(tabId, 'Page.navigateToHistoryEntry', { entryId: entry.id });
  }
}

/**
 * Reload the page via CDP.
 */
export async function cdpReload(tabId: number, ignoreCache: boolean = false): Promise<void> {
  await sendCommand(tabId, 'Page.reload', { ignoreCache });
}

// Clean up debugger attachments when tabs close
chrome.tabs.onRemoved.addListener((tabId) => {
  attachedTabs.delete(tabId);
});

// Listen for debugger detach events
chrome.debugger.onDetach.addListener((source) => {
  if (source.tabId) {
    attachedTabs.delete(source.tabId);
    console.log(`[CDP] Debugger detached from tab ${source.tabId}`);
  }
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
