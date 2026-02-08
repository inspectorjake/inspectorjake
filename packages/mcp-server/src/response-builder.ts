/**
 * MCP response builder utilities for Inspector Jake.
 * Single source of truth for building MCP tool responses.
 *
 * Eliminates duplication of error responses and selection rendering.
 */

import { stripBase64Prefix, formatDimensions } from '@inspector-jake/shared';

/**
 * Content item in MCP response.
 * Uses index signature for compatibility with MCP SDK.
 */
export interface ContentItem {
  type: 'text' | 'image';
  text?: string;
  data?: string;
  mimeType?: string;
  [key: string]: unknown;
}

/**
 * MCP tool response.
 * Uses index signature for compatibility with MCP SDK.
 */
export interface ToolResult {
  content: ContentItem[];
  isError?: boolean;
  [key: string]: unknown;
}

/**
 * Selection data structure.
 */
export interface SelectionData {
  type: 'element' | 'screenshot';
  id: string;
  image?: string;
  selector?: string;
  tagName?: string;
  className?: string;
  width: number;
  height: number;
  rect: { x: number; y: number; width: number; height: number };
  computedStyles?: Record<string, string>;
  hint?: string;
  note?: string;
}

/**
 * Build an error response.
 */
export function errorResponse(message: string): ToolResult {
  return {
    content: [{ type: 'text', text: `Error: ${message}` }],
    isError: true,
  };
}

/**
 * Build a JSON text response.
 */
export function jsonResponse(data: unknown): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  };
}

/**
 * Build an image response with optional caption.
 */
export function imageResponse(
  imageData: string,
  caption?: string,
  mimeType = 'image/png'
): ToolResult {
  const content: ContentItem[] = [
    {
      type: 'image',
      data: stripBase64Prefix(imageData),
      mimeType,
    },
  ];

  if (caption) {
    content.push({ type: 'text', text: caption });
  }

  return { content };
}

/**
 * Render selections into content items.
 * Screenshots include inline images; elements include metadata with hints.
 *
 * This function consolidates the selection rendering logic that was
 * previously duplicated in 4+ places in server.ts.
 */
export function renderSelections(selections: SelectionData[] | null | undefined): ContentItem[] {
  if (!selections?.length) return [];

  const content: ContentItem[] = [];
  const elements = selections.filter((s) => s.type === 'element');
  const screenshots = selections.filter((s) => s.type === 'screenshot');

  // Screenshots: include full image data inline
  for (const shot of screenshots) {
    if (shot.image) {
      content.push({
        type: 'image',
        data: stripBase64Prefix(shot.image),
        mimeType: 'image/png',
      });
      let shotText = `Screenshot region: ${formatDimensions(shot)}`;
      if (shot.note) {
        shotText += `\n    User note: "${shot.note}"`;
      }
      content.push({
        type: 'text',
        text: shotText,
      });
    }
  }

  // Elements: include metadata with hints and computed styles
  if (elements.length) {
    content.push({
      type: 'text',
      text: `Element selections (${elements.length}):\n${elements
        .map((e) => {
          let text = `  - [${e.id}] ${e.tagName} "${e.selector}" (${formatDimensions(e)})\n    ${e.hint}`;
          if (e.note) {
            text += `\n    User note: "${e.note}"`;
          }
          if (e.computedStyles && Object.keys(e.computedStyles).length > 0) {
            const styleLines = Object.entries(e.computedStyles)
              .map(([prop, value]) => `      ${prop}: ${value}`)
              .join('\n');
            text += `\n    Computed styles:\n${styleLines}`;
          }
          return text;
        })
        .join('\n')}`,
    });
  }

  return content;
}
