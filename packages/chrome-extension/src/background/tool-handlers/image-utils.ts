/**
 * Image processing utilities for screenshot capture.
 * Handles cropping, resizing, and data URL conversion.
 */

/**
 * Convert a Blob to a data URL string.
 */
export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Crop a data URL image to a specific rect.
 */
export async function cropImageToRect(
  dataUrl: string,
  rect: { x: number; y: number; width: number; height: number }
): Promise<{ image: string; width: number; height: number }> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const imageBitmap = await createImageBitmap(blob);

  const x = Math.max(0, Math.min(rect.x, imageBitmap.width));
  const y = Math.max(0, Math.min(rect.y, imageBitmap.height));
  const width = Math.min(rect.width, imageBitmap.width - x);
  const height = Math.min(rect.height, imageBitmap.height - y);

  if (width <= 0 || height <= 0) {
    throw new Error('Capture region is outside the visible viewport');
  }

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  ctx.drawImage(imageBitmap, x, y, width, height, 0, 0, width, height);

  const croppedBlob = await canvas.convertToBlob({ type: 'image/png' });
  const image = await blobToDataUrl(croppedBlob);

  return { image, width, height };
}

/**
 * Read max screenshot dimension from chrome.storage.local (set by DevTools settings panel).
 */
export async function getMaxScreenshotDimension(): Promise<number> {
  const result = await chrome.storage.local.get('maxScreenshotDimension');
  return result.maxScreenshotDimension || 800;
}

/**
 * Downscale an image if either dimension exceeds maxDim, preserving aspect ratio.
 */
export async function resizeImageIfNeeded(
  dataUrl: string,
  width: number,
  height: number,
  maxDim: number
): Promise<{ image: string; width: number; height: number }> {
  if (width <= maxDim && height <= maxDim) {
    return { image: dataUrl, width, height };
  }

  const scale = maxDim / Math.max(width, height);
  const newWidth = Math.round(width * scale);
  const newHeight = Math.round(height * scale);

  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const imageBitmap = await createImageBitmap(blob);

  const canvas = new OffscreenCanvas(newWidth, newHeight);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(imageBitmap, 0, 0, newWidth, newHeight);

  const resizedBlob = await canvas.convertToBlob({ type: 'image/png' });
  const image = await blobToDataUrl(resizedBlob);

  return { image, width: newWidth, height: newHeight };
}
