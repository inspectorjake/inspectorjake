/**
 * Tests for image utilities.
 * These tests validate the behavior before and after refactoring.
 */

import { describe, it, expect } from 'vitest';
import {
  stripBase64Prefix,
  ensureBase64Prefix,
  isValidBase64Image,
} from '../image.js';

describe('stripBase64Prefix', () => {
  it('should strip PNG data URL prefix', () => {
    const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    expect(stripBase64Prefix(dataUrl)).toBe('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
  });

  it('should strip JPEG data URL prefix', () => {
    const dataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/';
    expect(stripBase64Prefix(dataUrl)).toBe('/9j/4AAQSkZJRgABAQEAYABgAAD/');
  });

  it('should strip WebP data URL prefix', () => {
    const dataUrl = 'data:image/webp;base64,UklGRhYAAABXRUJQVlA4TAoAAAAvAAAAAEBJJQA=';
    expect(stripBase64Prefix(dataUrl)).toBe('UklGRhYAAABXRUJQVlA4TAoAAAAvAAAAAEBJJQA=');
  });

  it('should strip GIF data URL prefix', () => {
    const dataUrl = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    expect(stripBase64Prefix(dataUrl)).toBe('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');
  });

  it('should return same string if no prefix', () => {
    const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    expect(stripBase64Prefix(base64)).toBe(base64);
  });

  it('should handle empty string', () => {
    expect(stripBase64Prefix('')).toBe('');
  });
});

describe('ensureBase64Prefix', () => {
  it('should add PNG prefix by default', () => {
    const base64 = 'iVBORw0KGgoAAAANSUhEUg==';
    expect(ensureBase64Prefix(base64)).toBe('data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==');
  });

  it('should add specified MIME type prefix', () => {
    const base64 = '/9j/4AAQSkZJRgABAQEA';
    expect(ensureBase64Prefix(base64, 'image/jpeg')).toBe('data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEA');
  });

  it('should not double-prefix existing data URLs', () => {
    const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';
    expect(ensureBase64Prefix(dataUrl)).toBe(dataUrl);
  });

  it('should detect any existing data: prefix', () => {
    const dataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
    expect(ensureBase64Prefix(dataUrl, 'image/png')).toBe(dataUrl);
  });
});

describe('isValidBase64Image', () => {
  it('should return true for valid base64 with prefix', () => {
    const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    expect(isValidBase64Image(dataUrl)).toBe(true);
  });

  it('should return true for valid base64 without prefix', () => {
    const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    expect(isValidBase64Image(base64)).toBe(true);
  });

  it('should return true for base64 with padding', () => {
    expect(isValidBase64Image('YWJj')).toBe(true);
    expect(isValidBase64Image('YWJjZA==')).toBe(true);
    expect(isValidBase64Image('YWJjZGU=')).toBe(true);
  });

  it('should return false for empty string', () => {
    expect(isValidBase64Image('')).toBe(false);
  });

  it('should return false for null/undefined', () => {
    expect(isValidBase64Image(null as any)).toBe(false);
    expect(isValidBase64Image(undefined as any)).toBe(false);
  });

  it('should return false for invalid base64 characters', () => {
    expect(isValidBase64Image('invalid!@#$%')).toBe(false);
    expect(isValidBase64Image('has spaces here')).toBe(false);
  });
});
