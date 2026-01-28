/**
 * Tests for accessibility utilities.
 * These tests validate the behavior before and after refactoring.
 */

import { describe, it, expect } from 'vitest';
import {
  IMPLICIT_ROLES,
  getImplicitRole,
  computeAccessibleName,
  type AccessibleNameContext,
} from '../accessibility.js';

describe('IMPLICIT_ROLES', () => {
  it('should map common HTML elements to their implicit ARIA roles', () => {
    expect(IMPLICIT_ROLES['a']).toBe('link');
    expect(IMPLICIT_ROLES['button']).toBe('button');
    expect(IMPLICIT_ROLES['nav']).toBe('navigation');
    expect(IMPLICIT_ROLES['main']).toBe('main');
    expect(IMPLICIT_ROLES['header']).toBe('banner');
    expect(IMPLICIT_ROLES['footer']).toBe('contentinfo');
  });

  it('should map heading elements to heading role', () => {
    expect(IMPLICIT_ROLES['h1']).toBe('heading');
    expect(IMPLICIT_ROLES['h2']).toBe('heading');
    expect(IMPLICIT_ROLES['h3']).toBe('heading');
    expect(IMPLICIT_ROLES['h4']).toBe('heading');
    expect(IMPLICIT_ROLES['h5']).toBe('heading');
    expect(IMPLICIT_ROLES['h6']).toBe('heading');
  });

  it('should map form elements correctly', () => {
    expect(IMPLICIT_ROLES['form']).toBe('form');
    expect(IMPLICIT_ROLES['input']).toBe('textbox');
    expect(IMPLICIT_ROLES['textarea']).toBe('textbox');
    expect(IMPLICIT_ROLES['select']).toBe('listbox');
    expect(IMPLICIT_ROLES['option']).toBe('option');
  });

  it('should map list elements correctly', () => {
    expect(IMPLICIT_ROLES['ul']).toBe('list');
    expect(IMPLICIT_ROLES['ol']).toBe('list');
    expect(IMPLICIT_ROLES['li']).toBe('listitem');
  });

  it('should map table elements correctly', () => {
    expect(IMPLICIT_ROLES['table']).toBe('table');
    expect(IMPLICIT_ROLES['tr']).toBe('row');
    expect(IMPLICIT_ROLES['td']).toBe('cell');
    expect(IMPLICIT_ROLES['th']).toBe('columnheader');
    expect(IMPLICIT_ROLES['thead']).toBe('rowgroup');
    expect(IMPLICIT_ROLES['tbody']).toBe('rowgroup');
  });
});

describe('getImplicitRole', () => {
  it('should return the implicit role for a known tag', () => {
    expect(getImplicitRole('button')).toBe('button');
    expect(getImplicitRole('nav')).toBe('navigation');
    expect(getImplicitRole('img')).toBe('image');
  });

  it('should be case-insensitive', () => {
    expect(getImplicitRole('BUTTON')).toBe('button');
    expect(getImplicitRole('NAV')).toBe('navigation');
    expect(getImplicitRole('Button')).toBe('button');
  });

  it('should return null for unknown tags', () => {
    expect(getImplicitRole('div')).toBeNull();
    expect(getImplicitRole('span')).toBeNull();
    expect(getImplicitRole('custom-element')).toBeNull();
  });
});

describe('computeAccessibleName', () => {
  const createContext = (overrides: Partial<AccessibleNameContext>): AccessibleNameContext => ({
    tagName: 'div',
    getAttribute: () => null,
    ...overrides,
  });

  it('should return aria-label if present', () => {
    const ctx = createContext({
      getAttribute: (name) => (name === 'aria-label' ? 'My Label' : null),
    });
    expect(computeAccessibleName(ctx)).toBe('My Label');
  });

  it('should return aria-labelledby referenced text if present', () => {
    const ctx = createContext({
      getAttribute: (name) => (name === 'aria-labelledby' ? 'label-id' : null),
      getElementById: (id) =>
        id === 'label-id' ? { textContent: '  Referenced Label  ' } : null,
    });
    expect(computeAccessibleName(ctx)).toBe('Referenced Label');
  });

  it('should return alt attribute for images', () => {
    const ctx = createContext({
      tagName: 'img',
      getAttribute: (name) => (name === 'alt' ? 'Image description' : null),
    });
    expect(computeAccessibleName(ctx)).toBe('Image description');
  });

  it('should return title attribute', () => {
    const ctx = createContext({
      getAttribute: (name) => (name === 'title' ? 'Title text' : null),
    });
    expect(computeAccessibleName(ctx)).toBe('Title text');
  });

  it('should return placeholder for inputs', () => {
    const ctx = createContext({
      tagName: 'input',
      getAttribute: (name) => (name === 'placeholder' ? 'Enter text...' : null),
    });
    expect(computeAccessibleName(ctx)).toBe('Enter text...');
  });

  it('should return innerText for buttons', () => {
    const ctx = createContext({
      tagName: 'button',
      innerText: 'Click me',
      getAttribute: () => null,
    });
    expect(computeAccessibleName(ctx)).toBe('Click me');
  });

  it('should return innerText for headings', () => {
    for (const tag of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']) {
      const ctx = createContext({
        tagName: tag,
        innerText: 'Heading Text',
        getAttribute: () => null,
      });
      expect(computeAccessibleName(ctx)).toBe('Heading Text');
    }
  });

  it('should return innerText for links', () => {
    const ctx = createContext({
      tagName: 'a',
      innerText: 'Link text',
      getAttribute: () => null,
    });
    expect(computeAccessibleName(ctx)).toBe('Link text');
  });

  it('should truncate long innerText to 100 chars', () => {
    const longText = 'a'.repeat(150);
    const ctx = createContext({
      tagName: 'button',
      innerText: longText,
      getAttribute: () => null,
    });
    expect(computeAccessibleName(ctx)).toBe('a'.repeat(100));
  });

  it('should trim whitespace from innerText', () => {
    const ctx = createContext({
      tagName: 'button',
      innerText: '  Button Text  ',
      getAttribute: () => null,
    });
    expect(computeAccessibleName(ctx)).toBe('Button Text');
  });

  it('should return null for div with no accessible name sources', () => {
    const ctx = createContext({
      tagName: 'div',
      getAttribute: () => null,
    });
    expect(computeAccessibleName(ctx)).toBeNull();
  });

  it('should prioritize aria-label over other sources', () => {
    const ctx = createContext({
      tagName: 'button',
      innerText: 'Button Text',
      getAttribute: (name) => (name === 'aria-label' ? 'ARIA Label' : null),
    });
    expect(computeAccessibleName(ctx)).toBe('ARIA Label');
  });
});
