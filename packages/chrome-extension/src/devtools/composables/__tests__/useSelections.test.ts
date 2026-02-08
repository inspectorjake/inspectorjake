/**
 * Tests for useSelections composable.
 * Covers selection state management, deduplication, and sync behavior.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { nextTick } from 'vue';
import { useSelections } from '../useSelections.js';
import type { ElementInfo } from '@inspector-jake/shared';

// Mock chrome.runtime.sendMessage
const mockSendMessage = vi.fn().mockResolvedValue({});
const mockTabSendMessage = vi.fn().mockResolvedValue({});
const inspectedWindow = { tabId: 123 };
vi.stubGlobal('chrome', {
  runtime: {
    sendMessage: mockSendMessage,
  },
  tabs: {
    sendMessage: mockTabSendMessage,
  },
  devtools: {
    inspectedWindow,
  },
});

describe('useSelections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    inspectedWindow.tabId = 123;
  });

  describe('initial state', () => {
    it('should have empty selections array', () => {
      const { selections } = useSelections();
      expect(selections.value).toEqual([]);
    });

    it('should have null expandedId', () => {
      const { expandedId } = useSelections();
      expect(expandedId.value).toBeNull();
    });

    it('should have null expandedSelection when no selections', () => {
      const { expandedSelection } = useSelections();
      expect(expandedSelection.value).toBeNull();
    });
  });

  describe('toggleExpanded', () => {
    it('should set expandedId when toggling a new id', () => {
      const { expandedId, toggleExpanded } = useSelections();
      toggleExpanded('test-id');
      expect(expandedId.value).toBe('test-id');
    });

    it('should clear expandedId when toggling same id', () => {
      const { expandedId, toggleExpanded } = useSelections();
      toggleExpanded('test-id');
      toggleExpanded('test-id');
      expect(expandedId.value).toBeNull();
    });

    it('should switch expandedId when toggling different id', () => {
      const { expandedId, toggleExpanded } = useSelections();
      toggleExpanded('first');
      toggleExpanded('second');
      expect(expandedId.value).toBe('second');
    });
  });

  describe('addScreenshotSelection', () => {
    it('should add a screenshot selection', async () => {
      const { selections, addScreenshotSelection } = useSelections();
      const rect = { x: 0, y: 0, width: 100, height: 50 };
      const image = 'data:image/png;base64,abc123';

      addScreenshotSelection(rect, image);
      await nextTick();

      expect(selections.value).toHaveLength(1);
      expect(selections.value[0].type).toBe('screenshot');
      expect(selections.value[0].image).toBe(image);
      expect(selections.value[0].width).toBe(100);
      expect(selections.value[0].height).toBe(50);
      expect(selections.value[0].rect).toEqual(rect);
    });

    it('should auto-expand newly added screenshot', async () => {
      const { expandedId, addScreenshotSelection } = useSelections();
      const rect = { x: 0, y: 0, width: 100, height: 50 };

      addScreenshotSelection(rect, 'data:image/png;base64,abc');
      await nextTick();

      expect(expandedId.value).toMatch(/^shot-/);
    });

    it('should deduplicate screenshots with same rect within 100ms', async () => {
      const { selections, addScreenshotSelection } = useSelections();
      const rect = { x: 10, y: 20, width: 100, height: 50 };

      addScreenshotSelection(rect, 'data:image/png;base64,first');
      addScreenshotSelection(rect, 'data:image/png;base64,second');
      await nextTick();

      expect(selections.value).toHaveLength(1);
    });

    it('should allow screenshots with different rects', async () => {
      const { selections, addScreenshotSelection } = useSelections();

      addScreenshotSelection({ x: 0, y: 0, width: 100, height: 50 }, 'img1');
      addScreenshotSelection({ x: 10, y: 10, width: 200, height: 100 }, 'img2');
      await nextTick();

      expect(selections.value).toHaveLength(2);
    });

    it('should sync to background after adding', async () => {
      const { addScreenshotSelection } = useSelections();
      mockSendMessage.mockClear();

      addScreenshotSelection({ x: 0, y: 0, width: 100, height: 50 }, 'img');
      await nextTick();

      expect(mockSendMessage).toHaveBeenCalledWith({
        type: 'SYNC_SELECTIONS',
        selections: expect.any(Array),
      });
    });
  });

  describe('addElementSelection', () => {
    const createMockElement = (overrides: Partial<ElementInfo> = {}): ElementInfo => ({
      tagName: 'div',
      selector: 'div.container',
      className: 'container',
      rect: { x: 0, y: 0, width: 100, height: 50 },
      attributes: {},
      ...overrides,
    });

    // Mock screenshot capture that always succeeds
    const mockCaptureScreenshot = vi.fn().mockResolvedValue('data:image/png;base64,mock');

    beforeEach(() => {
      mockCaptureScreenshot.mockClear();
    });

    it('should skip if element has no rect', async () => {
      const { selections, addElementSelection } = useSelections();

      await addElementSelection({ ...createMockElement(), rect: undefined as any }, mockCaptureScreenshot);

      expect(selections.value).toHaveLength(0);
    });

    it('should skip if selector already exists', async () => {
      const { selections, addElementSelection } = useSelections();
      const element = createMockElement({ selector: 'div.unique' });

      await addElementSelection(element, mockCaptureScreenshot);
      await addElementSelection(element, mockCaptureScreenshot);

      expect(selections.value).toHaveLength(1);
    });

    it('should deduplicate elements with same selector within 100ms', async () => {
      const { selections, addElementSelection } = useSelections();
      const element1 = createMockElement({ selector: 'div.test' });
      const element2 = createMockElement({ selector: 'div.test', className: 'different' });

      await addElementSelection(element1, mockCaptureScreenshot);
      await addElementSelection(element2, mockCaptureScreenshot);

      expect(selections.value).toHaveLength(1);
    });

    it('should auto-expand newly added element', async () => {
      const { expandedId, addElementSelection } = useSelections();

      await addElementSelection(createMockElement(), mockCaptureScreenshot);

      expect(expandedId.value).toMatch(/^elem-/);
    });

    it('should skip if screenshot capture fails', async () => {
      const { selections, addElementSelection } = useSelections();
      const failingCapture = vi.fn().mockResolvedValue(null);

      await addElementSelection(createMockElement(), failingCapture);

      expect(selections.value).toHaveLength(0);
    });

    it('should add element without screenshot if no capture callback', async () => {
      const { selections, addElementSelection } = useSelections();

      await addElementSelection(createMockElement());

      expect(selections.value).toHaveLength(1);
      expect(selections.value[0].image).toBe('');
    });
  });

  describe('removeSelection', () => {
    it('should remove selection by id', async () => {
      const { selections, addScreenshotSelection, removeSelection } = useSelections();
      addScreenshotSelection({ x: 0, y: 0, width: 100, height: 50 }, 'img');
      await nextTick();

      const id = selections.value[0].id;
      removeSelection(id);

      expect(selections.value).toHaveLength(0);
    });

    it('should clear expandedId if removing expanded selection', async () => {
      const { selections, expandedId, addScreenshotSelection, removeSelection } = useSelections();
      addScreenshotSelection({ x: 0, y: 0, width: 100, height: 50 }, 'img');
      await nextTick();

      const id = selections.value[0].id;
      expect(expandedId.value).toBe(id);

      removeSelection(id);

      expect(expandedId.value).toBeNull();
    });

    it('should not affect expandedId when removing other selection', async () => {
      const { selections, expandedId, addScreenshotSelection, toggleExpanded, removeSelection } = useSelections();
      addScreenshotSelection({ x: 0, y: 0, width: 100, height: 50 }, 'img1');
      addScreenshotSelection({ x: 10, y: 10, width: 200, height: 100 }, 'img2');
      await nextTick();

      const [first, second] = selections.value;
      toggleExpanded(first.id); // manually set to first

      removeSelection(second.id);

      expect(expandedId.value).toBe(first.id);
      expect(selections.value).toHaveLength(1);
    });

    it('should sync to background after removing', async () => {
      const { selections, addScreenshotSelection, removeSelection } = useSelections();
      addScreenshotSelection({ x: 0, y: 0, width: 100, height: 50 }, 'img');
      await nextTick();
      mockSendMessage.mockClear();

      removeSelection(selections.value[0].id);

      expect(mockSendMessage).toHaveBeenCalledWith({
        type: 'SYNC_SELECTIONS',
        selections: [],
      });
    });
  });

  describe('clearAllSelections', () => {
    it('should clear all selections', async () => {
      const { selections, addScreenshotSelection, clearAllSelections } = useSelections();
      addScreenshotSelection({ x: 0, y: 0, width: 100, height: 50 }, 'img1');
      addScreenshotSelection({ x: 10, y: 10, width: 200, height: 100 }, 'img2');
      await nextTick();

      clearAllSelections();

      expect(selections.value).toHaveLength(0);
    });

    it('should clear expandedId', async () => {
      const { expandedId, addScreenshotSelection, clearAllSelections } = useSelections();
      addScreenshotSelection({ x: 0, y: 0, width: 100, height: 50 }, 'img');
      await nextTick();

      clearAllSelections();

      expect(expandedId.value).toBeNull();
    });

    it('should sync to background after clearing', async () => {
      const { addScreenshotSelection, clearAllSelections } = useSelections();
      addScreenshotSelection({ x: 0, y: 0, width: 100, height: 50 }, 'img');
      await nextTick();
      mockSendMessage.mockClear();

      clearAllSelections();

      expect(mockSendMessage).toHaveBeenCalledWith({
        type: 'SYNC_SELECTIONS',
        selections: [],
      });
    });
  });

  describe('refreshExpandedStyles', () => {
    const createMockElement = (overrides: Partial<ElementInfo> = {}): ElementInfo => ({
      tagName: 'div',
      selector: 'div.container',
      className: 'container',
      rect: { x: 0, y: 0, width: 100, height: 50 },
      attributes: {},
      ...overrides,
    });

    it('should do nothing when no selection is expanded', async () => {
      const { refreshExpandedStyles } = useSelections();

      await refreshExpandedStyles();

      expect(mockTabSendMessage).not.toHaveBeenCalled();
    });

    it('should do nothing when expanded selection is not an element', async () => {
      const { addScreenshotSelection, refreshExpandedStyles } = useSelections();

      addScreenshotSelection({ x: 0, y: 0, width: 100, height: 50 }, 'img');
      await refreshExpandedStyles();

      expect(mockTabSendMessage).not.toHaveBeenCalled();
    });

    it('should refresh computed styles on expanded element selection', async () => {
      const { selections, addElementSelection, refreshExpandedStyles } = useSelections();
      await addElementSelection(createMockElement({ selector: 'main > div:nth-of-type(2)' }));
      mockSendMessage.mockClear();
      mockTabSendMessage.mockResolvedValueOnce({
        success: true,
        computedStyles: { display: 'grid', color: 'rgb(0, 0, 0)' },
      });

      await refreshExpandedStyles();

      expect(mockTabSendMessage).toHaveBeenCalledWith(123, {
        type: 'REFRESH_ELEMENT_STYLES',
        selector: 'main > div:nth-of-type(2)',
      });
      expect(selections.value[0].type).toBe('element');
      expect((selections.value[0] as any).computedStyles).toEqual({
        display: 'grid',
        color: 'rgb(0, 0, 0)',
      });
      expect(mockSendMessage).toHaveBeenCalledWith({
        type: 'SYNC_SELECTIONS',
        selections: expect.any(Array),
      });
    });

    it('should do nothing when inspected tab id is unavailable', async () => {
      const { addElementSelection, refreshExpandedStyles } = useSelections();
      await addElementSelection(createMockElement());
      inspectedWindow.tabId = undefined as any;

      await refreshExpandedStyles();

      expect(mockTabSendMessage).not.toHaveBeenCalled();
    });
  });

  describe('updateSelectionNote', () => {
    it('should update note on the correct selection', async () => {
      const { selections, addScreenshotSelection, updateSelectionNote } = useSelections();
      addScreenshotSelection({ x: 0, y: 0, width: 100, height: 50 }, 'img1');
      addScreenshotSelection({ x: 10, y: 10, width: 200, height: 100 }, 'img2');
      await nextTick();

      const targetId = selections.value[0].id;
      updateSelectionNote(targetId, 'Center this vertically');

      expect(selections.value[0].note).toBe('Center this vertically');
      expect(selections.value[1].note).toBeUndefined();
    });

    it('should sync to background after updating note', async () => {
      const { selections, addScreenshotSelection, updateSelectionNote } = useSelections();
      addScreenshotSelection({ x: 0, y: 0, width: 100, height: 50 }, 'img');
      await nextTick();
      mockSendMessage.mockClear();

      updateSelectionNote(selections.value[0].id, 'Fix the color');

      expect(mockSendMessage).toHaveBeenCalledWith({
        type: 'SYNC_SELECTIONS',
        selections: expect.arrayContaining([
          expect.objectContaining({ note: 'Fix the color' }),
        ]),
      });
    });

    it('should not sync if selection id not found', async () => {
      const { addScreenshotSelection, updateSelectionNote } = useSelections();
      addScreenshotSelection({ x: 0, y: 0, width: 100, height: 50 }, 'img');
      await nextTick();
      mockSendMessage.mockClear();

      updateSelectionNote('non-existent-id', 'Some note');

      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it('should persist note through selection lifecycle', async () => {
      const { selections, addScreenshotSelection, updateSelectionNote } = useSelections();
      addScreenshotSelection({ x: 0, y: 0, width: 100, height: 50 }, 'img');
      await nextTick();

      const id = selections.value[0].id;
      updateSelectionNote(id, 'Make this bigger');

      // Verify note persists
      expect(selections.value.find(s => s.id === id)?.note).toBe('Make this bigger');
    });
  });

  describe('expandedSelection computed', () => {
    it('should return the expanded selection', async () => {
      const { selections, expandedSelection, addScreenshotSelection } = useSelections();
      addScreenshotSelection({ x: 0, y: 0, width: 100, height: 50 }, 'img');
      await nextTick();

      expect(expandedSelection.value).toBe(selections.value[0]);
    });

    it('should return null when expandedId does not match', async () => {
      const { expandedId, expandedSelection, addScreenshotSelection } = useSelections();
      addScreenshotSelection({ x: 0, y: 0, width: 100, height: 50 }, 'img');
      await nextTick();

      expandedId.value = 'non-existent';

      expect(expandedSelection.value).toBeNull();
    });
  });
});
