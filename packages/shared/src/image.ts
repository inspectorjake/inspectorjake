/**
 * Image processing utilities for Inspector Jake.
 * Single source of truth for base64 image data manipulation.
 *
 * Used by the MCP server for processing screenshot data.
 */

/** Regex to match data URL prefix for any image MIME type */
const DATA_URL_PREFIX_REGEX = /^data:image\/\w+;base64,/;

/**
 * Strip data URL prefix from base64 image data.
 * Handles various image MIME types (png, jpeg, webp, gif, etc.).
 */
export function stripBase64Prefix(dataUrl: string): string {
  return dataUrl.replace(DATA_URL_PREFIX_REGEX, '');
}

/**
 * Ensure data URL has proper prefix.
 * If already prefixed, returns as-is.
 */
export function ensureBase64Prefix(data: string, mimeType = 'image/png'): string {
  if (data.startsWith('data:')) return data;
  return `data:${mimeType};base64,${data}`;
}

/**
 * Validate that a string looks like valid base64 image data.
 * Strips prefix if present before validating.
 */
export function isValidBase64Image(data: string): boolean {
  if (!data) return false;
  const base64 = stripBase64Prefix(data);
  // Base64 characters: A-Z, a-z, 0-9, +, /, and = for padding
  return /^[A-Za-z0-9+/=]+$/.test(base64);
}
