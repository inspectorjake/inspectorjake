import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type ContentMessageListener = (
  message: { type: string; [key: string]: unknown },
  sender: unknown,
  sendResponse: (response?: unknown) => void
) => void;

const runtimeSendMessage = vi.fn();
let contentMessageListener: ContentMessageListener | null = null;

function dispatchContentMessage(type: string, payload: Record<string, unknown> = {}): void {
  if (!contentMessageListener) {
    throw new Error('Content message listener not initialized');
  }
  contentMessageListener({ type, ...payload }, {}, () => {});
}

async function loadContentScript(): Promise<void> {
  await import('../index.js');
  if (!contentMessageListener) {
    throw new Error('Content script did not register message listener');
  }
  (window as any).__jakesVibe.getElementInfo = vi.fn(() => ({
    tagName: 'BUTTON',
    selector: '#target',
    role: 'button',
  }));
}

function mouseEvent(type: string, button: number, clientX: number, clientY: number): MouseEvent {
  return new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button,
    clientX,
    clientY,
  });
}

describe('content picker click suppression', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers();
    contentMessageListener = null;

    document.body.innerHTML = '<button id="target">Target</button>';

    vi.stubGlobal('chrome', {
      runtime: {
        id: 'test-runtime-id',
        sendMessage: runtimeSendMessage,
        onMessage: {
          addListener: vi.fn((listener: ContentMessageListener) => {
            contentMessageListener = listener;
          }),
        },
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('suppresses the post-selection left click so target handler does not fire', async () => {
    await loadContentScript();
    dispatchContentMessage('START_ELEMENT_PICKER');

    const target = document.getElementById('target') as HTMLButtonElement;
    const targetClickSpy = vi.fn();
    target.addEventListener('click', targetClickSpy);

    target.dispatchEvent(mouseEvent('mousemove', 0, 10, 10));
    target.dispatchEvent(mouseEvent('mousedown', 0, 10, 10));
    target.dispatchEvent(mouseEvent('mouseup', 0, 10, 10));

    const clickAllowed = target.dispatchEvent(mouseEvent('click', 0, 10, 10));

    expect(clickAllowed).toBe(false);
    expect(targetClickSpy).not.toHaveBeenCalled();
    expect(runtimeSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'ELEMENT_PICKED' })
    );

    vi.runAllTimers();
  });

  it('does not suppress non-left click events while picker is active', async () => {
    await loadContentScript();
    dispatchContentMessage('START_ELEMENT_PICKER');

    const target = document.getElementById('target') as HTMLButtonElement;
    const targetClickSpy = vi.fn();
    target.addEventListener('click', targetClickSpy);

    const clickAllowed = target.dispatchEvent(mouseEvent('click', 2, 10, 10));

    expect(clickAllowed).toBe(true);
    expect(targetClickSpy).toHaveBeenCalledTimes(1);
  });

  it('suppresses left click-through after drag region selection', async () => {
    await loadContentScript();
    dispatchContentMessage('START_ELEMENT_PICKER');

    const target = document.getElementById('target') as HTMLButtonElement;
    const targetClickSpy = vi.fn();
    target.addEventListener('click', targetClickSpy);

    target.dispatchEvent(mouseEvent('mousedown', 0, 5, 5));
    target.dispatchEvent(mouseEvent('mousemove', 0, 40, 40));
    target.dispatchEvent(mouseEvent('mouseup', 0, 40, 40));

    const clickAllowed = target.dispatchEvent(mouseEvent('click', 0, 40, 40));

    expect(clickAllowed).toBe(false);
    expect(targetClickSpy).not.toHaveBeenCalled();
    expect(runtimeSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SCREENSHOT_REGION_SELECTED' })
    );

    vi.runAllTimers();
  });
});
