/**
 * Tests for rectangle utilities.
 * These tests validate the behavior before and after refactoring.
 */

import { describe, it, expect } from 'vitest';
import {
  toSimpleRect,
  scaleRect,
  formatDimensions,
  type Rect,
  type FullRect,
} from '../rect.js';

describe('toSimpleRect', () => {
  it('should extract x, y, width, height from FullRect', () => {
    const fullRect: FullRect = {
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      top: 20,
      right: 110,
      bottom: 70,
      left: 10,
    };
    expect(toSimpleRect(fullRect)).toEqual({
      x: 10,
      y: 20,
      width: 100,
      height: 50,
    });
  });

  it('should work with DOMRect-like objects', () => {
    const domRect = {
      x: 5,
      y: 15,
      width: 200,
      height: 150,
      top: 15,
      right: 205,
      bottom: 165,
      left: 5,
    };
    expect(toSimpleRect(domRect)).toEqual({
      x: 5,
      y: 15,
      width: 200,
      height: 150,
    });
  });

  it('should handle zero values', () => {
    const rect: FullRect = {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    };
    expect(toSimpleRect(rect)).toEqual({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    });
  });

  it('should handle negative values', () => {
    const rect: FullRect = {
      x: -10,
      y: -20,
      width: 100,
      height: 50,
      top: -20,
      right: 90,
      bottom: 30,
      left: -10,
    };
    expect(toSimpleRect(rect)).toEqual({
      x: -10,
      y: -20,
      width: 100,
      height: 50,
    });
  });
});

describe('scaleRect', () => {
  it('should scale rect by factor of 2', () => {
    const rect: Rect = { x: 10, y: 20, width: 100, height: 50 };
    expect(scaleRect(rect, 2)).toEqual({
      x: 20,
      y: 40,
      width: 200,
      height: 100,
    });
  });

  it('should scale rect by devicePixelRatio (common value 2)', () => {
    const rect: Rect = { x: 5, y: 10, width: 150, height: 75 };
    expect(scaleRect(rect, 2)).toEqual({
      x: 10,
      y: 20,
      width: 300,
      height: 150,
    });
  });

  it('should handle fractional scale factors', () => {
    const rect: Rect = { x: 10, y: 20, width: 100, height: 50 };
    const scaled = scaleRect(rect, 1.5);
    expect(scaled).toEqual({
      x: 15,
      y: 30,
      width: 150,
      height: 75,
    });
  });

  it('should round values when scaling results in decimals', () => {
    const rect: Rect = { x: 10, y: 20, width: 100, height: 50 };
    const scaled = scaleRect(rect, 1.33);
    expect(scaled.x).toBe(13);
    expect(scaled.y).toBe(27);
    expect(scaled.width).toBe(133);
    expect(scaled.height).toBe(67);
  });

  it('should handle scale factor of 1 (no change)', () => {
    const rect: Rect = { x: 10, y: 20, width: 100, height: 50 };
    expect(scaleRect(rect, 1)).toEqual(rect);
  });

  it('should handle scale factor less than 1', () => {
    const rect: Rect = { x: 20, y: 40, width: 200, height: 100 };
    expect(scaleRect(rect, 0.5)).toEqual({
      x: 10,
      y: 20,
      width: 100,
      height: 50,
    });
  });
});

describe('formatDimensions', () => {
  it('should format as WIDTHxHEIGHT', () => {
    expect(formatDimensions({ width: 100, height: 50 })).toBe('100x50');
  });

  it('should round floating point values', () => {
    expect(formatDimensions({ width: 100.4, height: 50.6 })).toBe('100x51');
  });

  it('should handle zero dimensions', () => {
    expect(formatDimensions({ width: 0, height: 0 })).toBe('0x0');
  });

  it('should handle large dimensions', () => {
    expect(formatDimensions({ width: 1920, height: 1080 })).toBe('1920x1080');
  });

  it('should work with full Rect objects', () => {
    const rect: Rect = { x: 10, y: 20, width: 800, height: 600 };
    expect(formatDimensions(rect)).toBe('800x600');
  });
});
