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
 * The extension sends `dimensions` + `rect`; `width`/`height` are accepted too.
 */
export interface SelectionData {
  type: 'element' | 'screenshot';
  id: string;
  image?: string;
  selector?: string;
  tagName?: string;
  className?: string | null;
  dimensions?: string;
  width?: number;
  height?: number;
  rect: { x: number; y: number; width: number; height: number };
  computedStyles?: Record<string, string>;
  hint?: string;
  note?: string;
  frameId?: number;
}

/**
 * "WxH" for a selection, from whichever size fields it carries.
 */
function selectionDimensions(s: SelectionData): string {
  if (s.dimensions) return s.dimensions;
  if (s.width !== undefined && s.height !== undefined) {
    return formatDimensions({ width: s.width, height: s.height });
  }
  return formatDimensions(s.rect);
}

/**
 * One element selection as a text block. Shared by tool responses and chat messages.
 */
function formatElementSelection(e: SelectionData, includeStyles = true): string {
  const iframePrefix = e.frameId !== undefined ? `[IFRAME frameId=${e.frameId}] ` : '';
  let text = `  - [${e.id}] ${iframePrefix}${e.tagName} "${e.selector}" (${selectionDimensions(e)})\n    ${e.hint}`;
  if (e.note) {
    text += `\n    User note: "${e.note}"`;
  }
  if (includeStyles && e.computedStyles && Object.keys(e.computedStyles).length > 0) {
    const styleLines = Object.entries(e.computedStyles)
      .map(([prop, value]) => `      ${prop}: ${value}`)
      .join('\n');
    text += `\n    Computed styles:\n${styleLines}`;
  }
  return text;
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
      let shotText = `Screenshot region: ${selectionDimensions(shot)}`;
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
        .map((e) => formatElementSelection(e))
        .join('\n')}`,
    });
  }

  return content;
}

/**
 * Render selections as plain text, for messages that can't carry images.
 * Screenshot regions point at view_image_in_jakes_notes instead of embedding the image.
 */
export function renderSelectionsText(
  selections: SelectionData[] | null | undefined,
  { includeStyles = true }: { includeStyles?: boolean } = {}
): string {
  if (!selections?.length) return '';

  const elements = selections.filter((s) => s.type === 'element');
  const screenshots = selections.filter((s) => s.type === 'screenshot');
  const blocks: string[] = [];

  if (elements.length) {
    blocks.push(
      `Element selections (${elements.length}):\n${elements
        .map((e) => formatElementSelection(e, includeStyles))
        .join('\n')}`
    );
  }

  if (screenshots.length) {
    blocks.push(
      `Screenshot regions (${screenshots.length}):\n${screenshots
        .map((s) => {
          let text = `  - [${s.id}] ${selectionDimensions(s)}`;
          if (s.note) {
            text += `\n    User note: "${s.note}"`;
          }
          return `${text}\n    Use view_image_in_jakes_notes tool with imageId="${s.id}" to see this region`;
        })
        .join('\n')}`
    );
  }

  return blocks.join('\n\n');
}

/** Bodies above this size drop computed styles. Claude Code's hard limit is 1 MiB per message. */
export const CHAT_BODY_SOFT_LIMIT = 100_000;

export interface ChatBodyInput {
  text: string;
  page?: { url: string; title: string };
  selections: SelectionData[];
  /** Name the receiving session should reply to */
  replyTo: string;
}

/**
 * Build the text a chat message from the DevTools panel carries to the Claude Code session.
 */
export function buildChatBody({ text, page, selections, replyTo }: ChatBodyInput): string {
  const header =
    'The user sent this from the Inspector Jake DevTools panel in Chrome.\n' +
    `Reply with SendMessage to "${replyTo}"; your reply appears in the panel.`;
  const pageLine = page ? `Page: ${page.title} — ${page.url}` : '';

  const build = (includeStyles: boolean) =>
    [header, text.trim(), pageLine, renderSelectionsText(selections, { includeStyles })]
      .filter(Boolean)
      .join('\n\n');

  const body = build(true);
  if (body.length <= CHAT_BODY_SOFT_LIMIT) return body;

  return `${build(false)}\n\n(Computed styles omitted to keep this message small; call see_jakes_notes for full details.)`;
}
