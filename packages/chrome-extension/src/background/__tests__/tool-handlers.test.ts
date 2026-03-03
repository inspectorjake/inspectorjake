import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ToolRequest } from '@inspector-jake/shared';

const sendMessageMock = vi.fn().mockResolvedValue(undefined);
const getStorageMock = vi.fn().mockResolvedValue({});
let handlers: typeof import('../tool-handlers.js');

function makeGetJakesNotesRequest(id: string): ToolRequest {
  return {
    id,
    type: 'see_jakes_notes',
    payload: {},
  };
}

function makeViewImageRequest(id: string, imageId: string): ToolRequest {
  return {
    id,
    type: 'view_image_in_jakes_notes',
    payload: { imageId },
  };
}

describe('tool-handlers see_jakes_notes auto-clear behavior', () => {
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

  it('auto-clears selections by default after see_jakes_notes', async () => {
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

  it('keeps view_image_in_jakes_notes resolvable after auto-clear', async () => {
    getStorageMock.mockResolvedValue({});
    handlers.updateSelections([
      {
        id: 'elem-1',
        type: 'element',
        timestamp: Date.now(),
        image: 'data:image/png;base64,elem1',
        width: 514,
        height: 78,
        rect: { x: 1, y: 2, width: 514, height: 78 },
        selector: 'main .card',
        tagName: 'div',
        className: 'card',
        attributes: [],
      },
    ]);

    const notesResult = await handlers.handleToolRequest(makeGetJakesNotesRequest('req-3'), null);
    const imageId = (notesResult.result as any)?.selections?.[0]?.id;

    expect(notesResult.success).toBe(true);
    expect(imageId).toBe('elem-1');
    expect(handlers.getSelections()).toHaveLength(0);

    const imageResult = await handlers.handleToolRequest(
      makeViewImageRequest('req-4', imageId),
      null,
    );

    expect(imageResult.success).toBe(true);
    expect(imageResult.result).toEqual({
      image: 'data:image/png;base64,elem1',
      width: 514,
      height: 78,
    });
  });

  it('keeps view_image_in_jakes_notes resolvable after manual clear', async () => {
    handlers.updateSelections([
      {
        id: 'shot-3',
        type: 'screenshot',
        timestamp: Date.now(),
        image: 'data:image/png;base64,manualclear',
        width: 120,
        height: 90,
        rect: { x: 0, y: 0, width: 120, height: 90 },
      },
    ]);

    handlers.clearSelections();
    expect(handlers.getSelections()).toHaveLength(0);

    const result = await handlers.handleToolRequest(makeViewImageRequest('req-5', 'shot-3'), null);

    expect(result.success).toBe(true);
    expect(result.result).toEqual({
      image: 'data:image/png;base64,manualclear',
      width: 120,
      height: 90,
    });
  });

  it('returns an error for unknown view_image_in_jakes_notes IDs', async () => {
    const result = await handlers.handleToolRequest(makeViewImageRequest('req-6', 'missing-id'), null);

    expect(result.success).toBe(true);
    expect(result.result).toEqual({ error: 'No image found with id: missing-id' });
  });
});
