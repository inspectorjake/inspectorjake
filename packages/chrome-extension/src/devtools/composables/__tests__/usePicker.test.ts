/**
 * Tests for usePicker composable.
 * Covers element picker state, highlighting, and screenshot capture.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePicker } from '../usePicker.js';

// Mock chrome APIs
const mockSendMessage = vi.fn();
const mockTabsSendMessage = vi.fn();
const mockExecuteScript = vi.fn();

vi.stubGlobal('chrome', {
  runtime: {
    sendMessage: mockSendMessage,
  },
  devtools: {
    inspectedWindow: {
      tabId: 123,
    },
  },
  tabs: {
    sendMessage: mockTabsSendMessage,
  },
  scripting: {
    executeScript: mockExecuteScript,
  },
});

describe('usePicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset and set default return values
    mockSendMessage.mockReset().mockResolvedValue({});
    mockTabsSendMessage.mockReset().mockResolvedValue({});
    mockExecuteScript.mockReset().mockResolvedValue([]);
  });

  describe('initial state', () => {
    it('should not be picking initially', () => {
      const { isPicking } = usePicker();
      expect(isPicking.value).toBe(false);
    });
  });

  describe('startElementPicker', () => {
    it('should set isPicking to true', async () => {
      const { isPicking, startElementPicker } = usePicker();
      mockTabsSendMessage.mockResolvedValue({});

      await startElementPicker();

      expect(isPicking.value).toBe(true);
    });

    it('should send START_ELEMENT_PICKER message to content script', async () => {
      const { startElementPicker } = usePicker();
      mockTabsSendMessage.mockResolvedValue({});

      await startElementPicker();

      expect(mockTabsSendMessage).toHaveBeenCalledWith(123, { type: 'START_ELEMENT_PICKER' });
    });

    it('should inject content script and retry if first send fails', async () => {
      const { isPicking, startElementPicker } = usePicker();
      mockTabsSendMessage
        .mockRejectedValueOnce(new Error('No receiver'))
        .mockResolvedValueOnce({});
      mockExecuteScript.mockResolvedValue([]);

      await startElementPicker();

      expect(mockExecuteScript).toHaveBeenCalledWith({
        target: { tabId: 123 },
        files: ['src/content/index.js'],
      });
      expect(mockTabsSendMessage).toHaveBeenCalledTimes(2);
      expect(isPicking.value).toBe(true);
    });

    it('should set error and isPicking false if retry also fails', async () => {
      const { isPicking, error, startElementPicker } = usePicker();
      mockTabsSendMessage.mockRejectedValue(new Error('No receiver'));
      mockExecuteScript.mockRejectedValue(new Error('Injection failed'));

      await startElementPicker();

      expect(isPicking.value).toBe(false);
      expect(error.value).toBe('Failed to start element picker');
    });

    it('should set error if no tabId available', async () => {
      // Override tabId to undefined
      const originalDevtools = chrome.devtools;
      (chrome as any).devtools = { inspectedWindow: { tabId: undefined } };

      const { error, startElementPicker } = usePicker();

      await startElementPicker();

      expect(error.value).toBe('No inspected tab');

      // Restore
      (chrome as any).devtools = originalDevtools;
    });
  });

  describe('stopElementPicker', () => {
    it('should set isPicking to false', () => {
      const { isPicking, stopElementPicker } = usePicker();
      isPicking.value = true;

      stopElementPicker();

      expect(isPicking.value).toBe(false);
    });

    it('should send STOP_ELEMENT_PICKER message', () => {
      const { stopElementPicker } = usePicker();
      mockTabsSendMessage.mockResolvedValue({});

      stopElementPicker();

      expect(mockTabsSendMessage).toHaveBeenCalledWith(123, { type: 'STOP_ELEMENT_PICKER' });
    });
  });

  describe('highlightSelector', () => {
    it('should send HIGHLIGHT_SELECTOR message', async () => {
      const { highlightSelector } = usePicker();
      mockTabsSendMessage.mockResolvedValue({});

      await highlightSelector('div.test');

      expect(mockTabsSendMessage).toHaveBeenCalledWith(123, {
        type: 'HIGHLIGHT_SELECTOR',
        selector: 'div.test',
      });
    });

    it('should not send if selector is empty', async () => {
      const { highlightSelector } = usePicker();

      await highlightSelector('');

      expect(mockTabsSendMessage).not.toHaveBeenCalled();
    });

    it('should handle errors silently', async () => {
      const { highlightSelector, error } = usePicker();
      mockTabsSendMessage.mockRejectedValue(new Error('No content script'));

      await highlightSelector('div.test');

      // Should not set error - silent failure
      expect(error.value).toBeNull();
    });
  });

  describe('clearHighlight', () => {
    it('should send CLEAR_HIGHLIGHT message', () => {
      const { clearHighlight } = usePicker();
      mockTabsSendMessage.mockResolvedValue({});

      clearHighlight();

      expect(mockTabsSendMessage).toHaveBeenCalledWith(123, { type: 'CLEAR_HIGHLIGHT' });
    });
  });

  describe('captureElementScreenshot', () => {
    it('should send CAPTURE_ELEMENT_SCREENSHOT message', async () => {
      const { captureElementScreenshot } = usePicker();
      mockSendMessage.mockResolvedValue({ image: 'data:image/png;base64,abc123' });

      const rect = { x: 10, y: 20, width: 100, height: 50 };
      const result = await captureElementScreenshot(rect);

      expect(mockSendMessage).toHaveBeenCalledWith({
        type: 'CAPTURE_ELEMENT_SCREENSHOT',
        rect,
        tabId: 123,
      });
      expect(result).toBe('data:image/png;base64,abc123');
    });

    it('should return null if response has no image', async () => {
      const { captureElementScreenshot } = usePicker();
      mockSendMessage.mockResolvedValue({});

      const result = await captureElementScreenshot({ x: 0, y: 0, width: 100, height: 50 });

      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      const { captureElementScreenshot } = usePicker();
      mockSendMessage.mockRejectedValue(new Error('Capture failed'));

      const result = await captureElementScreenshot({ x: 0, y: 0, width: 100, height: 50 });

      expect(result).toBeNull();
    });

    it('should return null if no tabId available', async () => {
      // Override tabId to undefined
      const originalDevtools = chrome.devtools;
      (chrome as any).devtools = { inspectedWindow: { tabId: undefined } };

      const { captureElementScreenshot } = usePicker();

      const result = await captureElementScreenshot({ x: 0, y: 0, width: 100, height: 50 });

      expect(result).toBeNull();

      // Restore
      (chrome as any).devtools = originalDevtools;
    });
  });

  describe('cancelPicking', () => {
    it('should set isPicking to false', () => {
      const { isPicking, cancelPicking } = usePicker();
      isPicking.value = true;

      cancelPicking();

      expect(isPicking.value).toBe(false);
    });
  });
});
