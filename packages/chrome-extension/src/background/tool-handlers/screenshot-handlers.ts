/**
 * Screenshot tool handlers extracted from tool-handlers.ts.
 *
 * Provides:
 * - handleScreenshot: internal capture using chrome.tabs.captureVisibleTab with optional CSS selector cropping.
 * - handleBrowserScreenshot: capture_screenshot MCP tool handler with ref/selector/fullPage support.
 * - captureElementScreenshot: utility that captures an element by rect, optionally using CDP clip for off-viewport elements.
 */

import type {
  ScreenshotResponse,
  BrowserScreenshotRequest,
} from '@inspector-jake/shared';

import { cropImageToRect, resizeImageIfNeeded, getMaxScreenshotDimension } from './image-utils.js';
import { resolveRefToScaledRect } from './page-scripts/resolve-ref.js';
import { attachDebugger, isDebuggerAttached, cdpScreenshot } from '../cdp.js';
import { log } from '../../utils/logger.js';

/**
 * Payload for the internal handleScreenshot function.
 */
interface ScreenshotRequest {
  selector?: string;
  fullPage?: boolean;
}

/**
 * Handle screenshot capture (internal, used by capture_screenshot fallback).
 * Supports optional CSS selector to capture specific element.
 */
export async function handleScreenshot(
  tabId: number | null,
  payload: ScreenshotRequest
): Promise<ScreenshotResponse> {
  if (!tabId) {
    throw new Error('No tab connected');
  }

  // Capture visible area using chrome.tabs.captureVisibleTab
  const dataUrl = await chrome.tabs.captureVisibleTab(undefined, {
    format: 'png',
  });

  // If selector provided, resolve element and crop to its bounds
  if (payload.selector) {
    // Resolve element after scrolling it into view.
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: (selector: string) => {
        const el = document.querySelector(selector);
        if (!el) return null;
        el.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'center' });
        const rect = el.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        return {
          x: Math.round(rect.x * dpr),
          y: Math.round(rect.y * dpr),
          width: Math.round(rect.width * dpr),
          height: Math.round(rect.height * dpr),
        };
      },
      args: [payload.selector ?? null],
    });

    if (!result?.result) {
      throw new Error(`Element not found: ${payload.selector}`);
    }

    const rect = result.result;

    // Crop to element rect and resize if needed
    const croppedImage = await cropImageToRect(dataUrl, rect);
    const maxDim = await getMaxScreenshotDimension();
    return resizeImageIfNeeded(croppedImage.image, croppedImage.width, croppedImage.height, maxDim);
  }

  // No selector - return full viewport, resized if needed
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => ({
      width: window.innerWidth,
      height: window.innerHeight,
    }),
  });

  const dimensions = results[0]?.result || { width: 0, height: 0 };
  const maxDim = await getMaxScreenshotDimension();
  return resizeImageIfNeeded(dataUrl, dimensions.width, dimensions.height, maxDim);
}

/**
 * Handle capture_screenshot tool.
 * Enhanced screenshot with ref support and full page option.
 */
export async function handleBrowserScreenshot(
  tabId: number | null,
  payload: BrowserScreenshotRequest
): Promise<ScreenshotResponse> {
  if (!tabId) {
    throw new Error('No tab connected');
  }

  // If ref is provided, resolve it to element coordinates
  if (payload.ref) {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: resolveRefToScaledRect,
      args: [payload.ref, null],
    });

    if (result?.result) {
      const dataUrl = await chrome.tabs.captureVisibleTab(undefined, { format: 'png' });
      const croppedImage = await cropImageToRect(dataUrl, result.result);
      const maxDim = await getMaxScreenshotDimension();
      return resizeImageIfNeeded(croppedImage.image, croppedImage.width, croppedImage.height, maxDim);
    }
  }

  // Fall back to existing screenshot logic
  return handleScreenshot(tabId, {
    selector: payload.selector,
    fullPage: payload.fullPage,
  });
}

/**
 * Find the bounding rect of an iframe element in its parent frame by URL.
 * Returns null if the iframe can't be found or access is restricted.
 */
async function getIframeBoundsInParent(
  tabId: number,
  frameId: number
): Promise<{ x: number; y: number; width: number; height: number } | null> {
  if (!frameId || frameId === 0) return null;

  try {
    const frames = await chrome.webNavigation.getAllFrames({ tabId });
    const frame = frames?.find(f => f.frameId === frameId);
    if (!frame || frame.parentFrameId < 0) {
      log.debug('Screenshot', `getIframeBoundsInParent: frame ${frameId} not found or no parent. frames count=${frames?.length ?? 0}`);
      return null;
    }

    log.debug('Screenshot', `getIframeBoundsInParent: frame ${frameId} found, parentFrameId=${frame.parentFrameId}, url=${frame.url}`);
    return await queryIframeBounds(tabId, frame.parentFrameId, frame.url);
  } catch (err) {
    log.warn('Screenshot', `getIframeBoundsInParent: failed for frameId=${frameId}:`, err);
    return null;
  }
}

/**
 * Ask a parent frame's content script for the bounding rect of an iframe by URL.
 */
async function queryIframeBounds(
  tabId: number,
  parentFrameId: number,
  childUrl: string
): Promise<{ x: number; y: number; width: number; height: number } | null> {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId, frameIds: [parentFrameId] },
      func: findIframeRectByUrl,
      args: [childUrl],
    });
    const bounds = result?.result ?? null;
    log.debug('Screenshot', `queryIframeBounds: parentFrameId=${parentFrameId}, childUrl=${childUrl}, result=${bounds ? JSON.stringify(bounds) : 'null'}`);
    return bounds;
  } catch (err) {
    log.warn('Screenshot', `queryIframeBounds: failed for parentFrameId=${parentFrameId}, childUrl=${childUrl}:`, err);
    return null;
  }
}

/**
 * Injected into the parent frame to find the iframe element's rect.
 */
function findIframeRectByUrl(
  childUrl: string
): { x: number; y: number; width: number; height: number } | null {
  for (const iframe of document.querySelectorAll('iframe')) {
    if (iframe.src !== childUrl) continue;
    const r = iframe.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  }
  return null;
}

/**
 * Capture an element screenshot by cropping a full-page screenshot.
 * Handles devicePixelRatio scaling for Retina/HiDPI displays.
 * For iframe elements, attempts coordinate translation from frame-local to page-level.
 */
export async function captureElementScreenshot(
  tabId: number,
  rect: { x: number; y: number; width: number; height: number },
  selector?: string,
  frameId?: number
): Promise<string | null> {
  const isIframe = frameId !== undefined && frameId !== 0;
  log.debug('Screenshot', `captureElementScreenshot: tabId=${tabId}, frameId=${frameId ?? 'none'}, isIframe=${isIframe}, selector=${selector ?? 'none'}, rect=${JSON.stringify(rect)}`);

  try {
    let scaledRect: { x: number; y: number; width: number; height: number };
    let clipRect: { x: number; y: number; width: number; height: number; scale: number } | null = null;

    // Determine the executeScript target: specific frame or top frame
    const scriptTarget: chrome.scripting.InjectionTarget = isIframe
      ? { tabId, frameIds: [frameId] }
      : { tabId };

    if (selector) {
      const [selectorResult] = await chrome.scripting.executeScript({
        target: scriptTarget,
        func: (sel: string) => {
          const element = document.querySelector(sel);
          if (!element) return null;

          element.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'center' });
          const resolved = element.getBoundingClientRect();
          const dpr = window.devicePixelRatio || 1;
          return {
            scaledRect: {
              x: Math.round(resolved.x * dpr),
              y: Math.round(resolved.y * dpr),
              width: Math.round(resolved.width * dpr),
              height: Math.round(resolved.height * dpr),
            },
            clipRect: {
              x: window.scrollX + resolved.left,
              y: window.scrollY + resolved.top,
              width: resolved.width,
              height: resolved.height,
              scale: 1,
            },
          };
        },
        args: [selector],
      });

      if (selectorResult?.result) {
        scaledRect = selectorResult.result.scaledRect;
        clipRect = selectorResult.result.clipRect;
      } else {
        const [dprResult] = await chrome.scripting.executeScript({
          target: scriptTarget,
          func: () => window.devicePixelRatio || 1,
        });
        const dpr = dprResult?.result || 1;
        scaledRect = {
          x: Math.round(rect.x * dpr),
          y: Math.round(rect.y * dpr),
          width: Math.round(rect.width * dpr),
          height: Math.round(rect.height * dpr),
        };
      }
    } else {
      const [dprResult] = await chrome.scripting.executeScript({
        target: scriptTarget,
        func: () => window.devicePixelRatio || 1,
      });
      const dpr = dprResult?.result || 1;
      scaledRect = {
        x: Math.round(rect.x * dpr),
        y: Math.round(rect.y * dpr),
        width: Math.round(rect.width * dpr),
        height: Math.round(rect.height * dpr),
      };
    }

    // For iframe elements, translate frame-local coordinates to page-level
    if (isIframe) {
      log.debug('Screenshot', `Attempting iframe coordinate translation for frameId=${frameId}`);
      const iframeBounds = await getIframeBoundsInParent(tabId, frameId);
      if (iframeBounds) {
        log.debug('Screenshot', `Iframe bounds found: ${JSON.stringify(iframeBounds)}`);
        // Get top-frame DPR for scaling the iframe offset
        const [topDprResult] = await chrome.scripting.executeScript({
          target: { tabId },
          func: () => window.devicePixelRatio || 1,
        });
        const topDpr = topDprResult?.result || 1;

        // Offset scaledRect by iframe position in parent (scaled by DPR)
        scaledRect = {
          x: scaledRect.x + Math.round(iframeBounds.x * topDpr),
          y: scaledRect.y + Math.round(iframeBounds.y * topDpr),
          width: scaledRect.width,
          height: scaledRect.height,
        };

        // Offset clipRect if present
        if (clipRect) {
          clipRect = {
            x: clipRect.x + iframeBounds.x,
            y: clipRect.y + iframeBounds.y,
            width: clipRect.width,
            height: clipRect.height,
            scale: clipRect.scale,
          };
        }
      } else {
        // Cross-origin or restricted iframe — can't translate coordinates
        log.warn('Screenshot', `Iframe coordinate translation failed for frameId=${frameId} — returning null (cross-origin or restricted)`);
        return null;
      }
    }

    if (clipRect && clipRect.width > 0 && clipRect.height > 0) {
      try {
        await attachDebugger(tabId);
        if (isDebuggerAttached(tabId)) {
          return await cdpScreenshot(tabId, {
            format: 'png',
            clip: clipRect,
            captureBeyondViewport: true,
          });
        }
      } catch {
        // Fall through to captureVisibleTab fallback.
      }
    }

    // Capture the visible area
    const fullDataUrl = await chrome.tabs.captureVisibleTab(undefined, {
      format: 'png',
    });

    // Crop to the visible portion of the target rect.
    const croppedImage = await cropImageToRect(fullDataUrl, scaledRect);
    return croppedImage.image;
  } catch (err) {
    log.error('Screenshot', `Failed to capture element screenshot (frameId=${frameId ?? 'none'}, selector=${selector ?? 'none'}):`, err);
    return null;
  }
}
