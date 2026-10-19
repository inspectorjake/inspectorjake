/**
 * Tests for MCP response builder utilities.
 * These tests validate the behavior before and after refactoring.
 */

import { describe, it, expect } from 'vitest';
import {
  errorResponse,
  jsonResponse,
  imageResponse,
  renderSelections,
  renderSelectionsText,
  buildChatBody,
  CHAT_BODY_SOFT_LIMIT,
  type ContentItem,
  type SelectionData,
} from '../response-builder.js';

describe('errorResponse', () => {
  it('should create error response with message', () => {
    const response = errorResponse('Something went wrong');
    expect(response).toEqual({
      content: [{ type: 'text', text: 'Error: Something went wrong' }],
      isError: true,
    });
  });

  it('should handle empty message', () => {
    const response = errorResponse('');
    expect(response).toEqual({
      content: [{ type: 'text', text: 'Error: ' }],
      isError: true,
    });
  });
});

describe('jsonResponse', () => {
  it('should stringify object with formatting', () => {
    const data = { name: 'test', value: 123 };
    const response = jsonResponse(data);
    expect(response).toEqual({
      content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    });
  });

  it('should handle arrays', () => {
    const data = [1, 2, 3];
    const response = jsonResponse(data);
    expect(response).toEqual({
      content: [{ type: 'text', text: '[\n  1,\n  2,\n  3\n]' }],
    });
  });

  it('should not have isError property', () => {
    const response = jsonResponse({});
    expect(response.isError).toBeUndefined();
  });
});

describe('imageResponse', () => {
  it('should create image response with stripped prefix', () => {
    const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';
    const response = imageResponse(dataUrl);
    expect(response.content[0]).toEqual({
      type: 'image',
      data: 'iVBORw0KGgoAAAANSUhEUg==',
      mimeType: 'image/png',
    });
  });

  it('should add caption when provided', () => {
    const dataUrl = 'data:image/png;base64,abc123==';
    const response = imageResponse(dataUrl, 'Screenshot: 100x50');
    expect(response.content).toHaveLength(2);
    expect(response.content[1]).toEqual({
      type: 'text',
      text: 'Screenshot: 100x50',
    });
  });

  it('should not add caption when not provided', () => {
    const dataUrl = 'data:image/png;base64,abc123==';
    const response = imageResponse(dataUrl);
    expect(response.content).toHaveLength(1);
  });

  it('should use custom MIME type', () => {
    const dataUrl = 'data:image/jpeg;base64,/9j/4AAQ==';
    const response = imageResponse(dataUrl, undefined, 'image/jpeg');
    expect(response.content[0]).toEqual({
      type: 'image',
      data: '/9j/4AAQ==',
      mimeType: 'image/jpeg',
    });
  });

  it('should handle raw base64 without prefix', () => {
    const base64 = 'iVBORw0KGgoAAAANSUhEUg==';
    const response = imageResponse(base64);
    expect(response.content[0]).toEqual({
      type: 'image',
      data: 'iVBORw0KGgoAAAANSUhEUg==',
      mimeType: 'image/png',
    });
  });
});

describe('renderSelections', () => {
  const createElementSelection = (overrides: Partial<SelectionData> = {}): SelectionData => ({
    type: 'element',
    id: 'el-1',
    selector: 'div.container',
    tagName: 'div',
    className: 'container',
    width: 100,
    height: 50,
    rect: { x: 10, y: 20, width: 100, height: 50 },
    hint: 'Use view_image_in_jakes_notes with imageId="el-1"',
    ...overrides,
  });

  const createScreenshotSelection = (overrides: Partial<SelectionData> = {}): SelectionData => ({
    type: 'screenshot',
    id: 'ss-1',
    image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',
    width: 200,
    height: 150,
    rect: { x: 0, y: 0, width: 200, height: 150 },
    ...overrides,
  });

  it('should return empty array for empty selections', () => {
    expect(renderSelections([])).toEqual([]);
  });

  it('should return empty array for null/undefined', () => {
    expect(renderSelections(null as any)).toEqual([]);
    expect(renderSelections(undefined as any)).toEqual([]);
  });

  it('should render screenshot selections with inline images', () => {
    const selections = [createScreenshotSelection()];
    const content = renderSelections(selections);

    expect(content).toHaveLength(2);
    expect(content[0]).toEqual({
      type: 'image',
      data: 'iVBORw0KGgoAAAANSUhEUg==',
      mimeType: 'image/png',
    });
    expect(content[1]).toEqual({
      type: 'text',
      text: 'Screenshot region: 200x150',
    });
  });

  it('should render element selections with metadata', () => {
    const selections = [createElementSelection()];
    const content = renderSelections(selections);

    expect(content).toHaveLength(1);
    expect(content[0].type).toBe('text');
    expect(content[0].text).toContain('Element selections (1)');
    expect(content[0].text).toContain('[el-1]');
    expect(content[0].text).toContain('div');
    expect(content[0].text).toContain('"div.container"');
    expect(content[0].text).toContain('100x50');
  });

  it('should render mixed selections with screenshots first', () => {
    const selections = [
      createElementSelection({ id: 'el-1' }),
      createScreenshotSelection({ id: 'ss-1' }),
      createElementSelection({ id: 'el-2' }),
    ];
    const content = renderSelections(selections);

    // Screenshot first (image + text), then elements summary
    expect(content[0].type).toBe('image');
    expect(content[1].type).toBe('text');
    expect(content[1].text).toContain('Screenshot region');
    expect(content[2].type).toBe('text');
    expect(content[2].text).toContain('Element selections (2)');
  });

  it('should skip screenshots without image data', () => {
    const selections = [createScreenshotSelection({ image: undefined })];
    const content = renderSelections(selections);
    expect(content).toEqual([]);
  });

  it('should include hint for each element', () => {
    const selections = [
      createElementSelection({
        id: 'el-1',
        hint: 'Use view_image_in_jakes_notes with imageId="el-1"',
      }),
    ];
    const content = renderSelections(selections);
    expect(content[0].text).toContain('Use view_image_in_jakes_notes with imageId="el-1"');
  });

  it('should include note for element selections', () => {
    const selections = [
      createElementSelection({ note: 'Center this vertically' }),
    ];
    const content = renderSelections(selections);
    expect(content[0].text).toContain('User note: "Center this vertically"');
  });

  it('should include note for screenshot selections', () => {
    const selections = [
      createScreenshotSelection({ note: 'This button color is wrong' }),
    ];
    const content = renderSelections(selections);
    const textItem = content.find(c => c.type === 'text');
    expect(textItem?.text).toContain('User note: "This button color is wrong"');
  });

  it('should omit note when empty or undefined', () => {
    const selections = [
      createElementSelection({ note: undefined }),
      createElementSelection({ id: 'el-2', selector: 'span.other', note: '' }),
      createScreenshotSelection({ note: undefined }),
    ];
    const content = renderSelections(selections);
    for (const item of content) {
      if (item.type === 'text') {
        expect(item.text).not.toContain('User note');
      }
    }
  });
});

describe('renderSelections with the extension wire format', () => {
  it('uses the preformatted dimensions when width and height are absent', () => {
    // buildSelectionsResponse() in the extension sends `dimensions` + `rect`, not width/height
    const content = renderSelections([
      {
        type: 'element',
        id: 'el-1',
        selector: 'button.cta',
        tagName: 'button',
        dimensions: '120x40',
        rect: { x: 0, y: 0, width: 120, height: 40 },
        hint: 'hint',
      },
    ]);
    expect(content[0].text).toContain('(120x40)');
    expect(content[0].text).not.toContain('NaN');
  });
});

describe('renderSelectionsText', () => {
  const element: SelectionData = {
    type: 'element',
    id: 'el-1',
    selector: 'button.cta',
    tagName: 'button',
    dimensions: '120x40',
    rect: { x: 0, y: 0, width: 120, height: 40 },
    hint: 'Use view_image_in_jakes_notes tool with imageId="el-1" to see this element\'s screenshot',
    note: 'Make this bigger',
    computedStyles: { 'font-size': '14px' },
  };
  const shot: SelectionData = {
    type: 'screenshot',
    id: 'ss-1',
    dimensions: '800x300',
    rect: { x: 0, y: 0, width: 800, height: 300 },
    note: 'Too much whitespace',
  };

  it('returns an empty string without selections', () => {
    expect(renderSelectionsText([])).toBe('');
    expect(renderSelectionsText(undefined)).toBe('');
  });

  it('renders elements and screenshot regions as text, with notes', () => {
    const text = renderSelectionsText([element, shot]);
    expect(text).toContain('Element selections (1):');
    expect(text).toContain('[el-1] button "button.cta" (120x40)');
    expect(text).toContain('User note: "Make this bigger"');
    expect(text).toContain('font-size: 14px');
    expect(text).toContain('Screenshot regions (1):');
    expect(text).toContain('[ss-1] 800x300');
    expect(text).toContain('User note: "Too much whitespace"');
    expect(text).toContain('imageId="ss-1"');
  });

  it('can leave out computed styles', () => {
    expect(renderSelectionsText([element], { includeStyles: false })).not.toContain('font-size');
  });
});

describe('buildChatBody', () => {
  const page = { url: 'https://example.com/pricing', title: 'Pricing' };

  it('includes the reply address, text, page and captures', () => {
    const body = buildChatBody({
      text: '  What did I select?  ',
      page,
      selections: [
        {
          type: 'element',
          id: 'el-1',
          selector: 'h1',
          tagName: 'h1',
          dimensions: '300x60',
          rect: { x: 0, y: 0, width: 300, height: 60 },
          hint: 'hint',
          note: 'Wrong font',
        },
      ],
      replyTo: 'jake-panel',
    });
    expect(body).toContain('Reply with SendMessage to "jake-panel"');
    expect(body).toContain('\n\nWhat did I select?\n\n');
    expect(body).toContain('Page: Pricing — https://example.com/pricing');
    expect(body).toContain('User note: "Wrong font"');
  });

  it('works with no page and no captures', () => {
    const body = buildChatBody({ text: 'hi', selections: [], replyTo: 'jake-panel' });
    expect(body.endsWith('\n\nhi')).toBe(true);
  });

  it('drops computed styles from oversized messages', () => {
    const bigStyles = Object.fromEntries(
      Array.from({ length: 4000 }, (_, i) => [`--custom-prop-${i}`, 'x'.repeat(20)])
    );
    const body = buildChatBody({
      text: 'big one',
      page,
      selections: [
        {
          type: 'element',
          id: 'el-1',
          selector: 'div',
          tagName: 'div',
          dimensions: '1x1',
          rect: { x: 0, y: 0, width: 1, height: 1 },
          hint: 'hint',
          note: 'keep me',
          computedStyles: bigStyles,
        },
      ],
      replyTo: 'jake-panel',
    });
    expect(body.length).toBeLessThan(CHAT_BODY_SOFT_LIMIT);
    expect(body).not.toContain('--custom-prop-1');
    expect(body).toContain('User note: "keep me"');
    expect(body).toContain('call see_jakes_notes for full details');
  });
});
