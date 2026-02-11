import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ToolRequest } from '@inspector-jake/shared';

const sendMessageMock = vi.fn().mockResolvedValue(undefined);
const getStorageMock = vi.fn();
let handlers: typeof import('../tool-handlers.js');

function makeGetJakesNotesRequest(id: string): ToolRequest {
  return {
    id,
    type: 'get_jakes_notes',
    payload: {},
  };
}

describe('tool-handlers get_jakes_notes auto-clear behavior', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: getStorageMock,
        },
      },
      runtime: {
        sendMessage: sendMessageMock,
      },
      tabs: {
        onRemoved: {
          addListener: vi.fn(),
        },
      },
      debugger: {
        onDetach: {
          addListener: vi.fn(),
        },
      },
    });

    handlers = await import('../tool-handlers.js');
    handlers.clearSelections();
  });

  it('auto-clears selections by default after get_jakes_notes', async () => {
    getStorageMock.mockResolvedValue({});
    handlers.updateSelections([
      {
        id: 'shot-1',
        type: 'screenshot',
        timestamp: Date.now(),
        image: 'data:image/png;base64,abc123',
        width: 100,
        height: 80,
        rect: { x: 1, y: 2, width: 100, height: 80 },
        note: 'Check spacing',
      },
    ]);

    const result = await handlers.handleToolRequest(makeGetJakesNotesRequest('req-1'), null);

    expect(result.success).toBe(true);
    expect((result.result as any)?.selections).toHaveLength(1);
    expect(handlers.getSelections()).toHaveLength(0);
    expect(sendMessageMock).toHaveBeenCalledWith({ type: 'SELECTIONS_AUTO_CLEARED' });
  });

  it('does not clear selections when auto-clear setting is disabled', async () => {
    getStorageMock.mockResolvedValue({ autoClearSelectionsAfterSeen: false });
    handlers.updateSelections([
      {
        id: 'shot-2',
        type: 'screenshot',
        timestamp: Date.now(),
        image: 'data:image/png;base64,xyz987',
        width: 120,
        height: 90,
        rect: { x: 0, y: 0, width: 120, height: 90 },
      },
    ]);

    const result = await handlers.handleToolRequest(makeGetJakesNotesRequest('req-2'), null);

    expect(result.success).toBe(true);
    expect((result.result as any)?.selections).toHaveLength(1);
    expect(handlers.getSelections()).toHaveLength(1);
    expect(sendMessageMock).not.toHaveBeenCalled();
  });
});
