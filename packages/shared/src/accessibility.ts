/**
 * Accessibility utilities for Inspector Jake.
 * Single source of truth for ARIA role mappings and accessible name computation.
 *
 * Used by both the Chrome extension content script and background tool handlers.
 */

/**
 * HTML elements with implicit ARIA roles per WAI-ARIA spec.
 * This is the canonical mapping - all packages should use this.
 */
export const IMPLICIT_ROLES: Readonly<Record<string, string>> = {
  a: 'link',
  article: 'article',
  aside: 'complementary',
  button: 'button',
  footer: 'contentinfo',
  form: 'form',
  h1: 'heading',
  h2: 'heading',
  h3: 'heading',
  h4: 'heading',
  h5: 'heading',
  h6: 'heading',
  header: 'banner',
  img: 'image',
  input: 'textbox',
  li: 'listitem',
  main: 'main',
  nav: 'navigation',
  ol: 'list',
  option: 'option',
  section: 'region',
  select: 'listbox',
  table: 'table',
  tbody: 'rowgroup',
  td: 'cell',
  textarea: 'textbox',
  th: 'columnheader',
  thead: 'rowgroup',
  tr: 'row',
  ul: 'list',
} as const;

/**
 * Get the implicit ARIA role for an element based on its tag name.
 * Case-insensitive.
 */
export function getImplicitRole(tagName: string): string | null {
  return IMPLICIT_ROLES[tagName.toLowerCase()] || null;
}

/**
 * Context for computing accessible names.
 * Abstraction layer that works in both DOM and non-DOM contexts.
 */
export interface AccessibleNameContext {
  /** Element tag name (e.g., 'button', 'div') */
  tagName: string;
  /** Get an attribute value by name */
  getAttribute: (name: string) => string | null;
  /** Inner text content (for buttons, links, headings) */
  innerText?: string;
  /** DOM getElementById for aria-labelledby resolution */
  getElementById?: (id: string) => { textContent: string | null } | null;
}

/** Elements whose text content should be used as accessible name */
const TEXT_CONTENT_ELEMENTS = [
  'button',
  'a',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'label',
];

/**
 * Compute the accessible name for an element following the ARIA name calculation algorithm.
 * Works in both DOM and non-DOM contexts by accepting an AccessibleNameContext.
 *
 * Priority order:
 * 1. aria-label
 * 2. aria-labelledby (if getElementById is provided)
 * 3. alt (for images)
 * 4. title
 * 5. placeholder (for inputs)
 * 6. innerText (for buttons, links, headings, labels)
 */
export function computeAccessibleName(ctx: AccessibleNameContext): string | null {
  // 1. aria-label takes precedence
  const ariaLabel = ctx.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel;

  // 2. aria-labelledby (if we can resolve it)
  const labelledBy = ctx.getAttribute('aria-labelledby');
  if (labelledBy && ctx.getElementById) {
    const labelEl = ctx.getElementById(labelledBy);
    if (labelEl?.textContent) {
      return labelEl.textContent.trim();
    }
  }

  // 3. alt (for images)
  const alt = ctx.getAttribute('alt');
  if (alt) return alt;

  // 4. title
  const title = ctx.getAttribute('title');
  if (title) return title;

  // 5. placeholder (for inputs)
  const placeholder = ctx.getAttribute('placeholder');
  if (placeholder) return placeholder;

  // 6. innerText for specific elements
  const tag = ctx.tagName.toLowerCase();
  if (TEXT_CONTENT_ELEMENTS.includes(tag) && ctx.innerText) {
    const trimmed = ctx.innerText.trim();
    if (trimmed) {
      return trimmed.slice(0, 100);
    }
  }

  return null;
}
