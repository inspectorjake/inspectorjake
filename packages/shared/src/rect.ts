/**
 * Rectangle utilities for Inspector Jake.
 * Single source of truth for bounding rectangle types and transformations.
 *
 * Used throughout the extension and MCP server for element positioning.
 */

/**
 * Minimal bounding rectangle with position and dimensions.
 */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Extended bounding rectangle with all edges (matches DOMRect structure).
 */
export interface FullRect extends Rect {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * Convert a DOMRect-like object to a simple Rect.
 * Useful for serialization and storage.
 */
export function toSimpleRect(rect: FullRect | DOMRect): Rect {
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  };
}

/**
 * Scale a rect by a factor (for devicePixelRatio handling).
 * All values are rounded to integers for pixel-perfect rendering.
 */
export function scaleRect(rect: Rect, scale: number): Rect {
  return {
    x: Math.round(rect.x * scale),
    y: Math.round(rect.y * scale),
    width: Math.round(rect.width * scale),
    height: Math.round(rect.height * scale),
  };
}

/**
 * Format rect dimensions as a "WIDTHxHEIGHT" string.
 * Values are rounded to integers.
 */
export function formatDimensions(rect: { width: number; height: number }): string {
  return `${Math.round(rect.width)}x${Math.round(rect.height)}`;
}
