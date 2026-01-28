/**
 * ARIA role constants and tag-to-role mappings.
 * Used for building accessibility trees from DOM elements.
 *
 * Extends the shared IMPLICIT_ROLES with additional role categorizations
 * needed for state tracking in the ARIA tree builder.
 */

/** Roles that can have checked state (aria-checked) */
export const CHECKABLE_ROLES: string[] = [
  'checkbox',
  'radio',
  'menuitemcheckbox',
  'menuitemradio',
  'switch',
];

/** Roles that can be disabled (aria-disabled) */
export const DISABLEABLE_ROLES: string[] = [
  'button',
  'textbox',
  'checkbox',
  'radio',
  'combobox',
  'listbox',
  'slider',
  'spinbutton',
];

/** Roles that can be expanded (aria-expanded) */
export const EXPANDABLE_ROLES: string[] = [
  'button',
  'combobox',
  'listbox',
  'treeitem',
  'row',
];

/** Roles that have levels (aria-level) */
export const LEVELED_ROLES: string[] = [
  'heading',
  'treeitem',
  'listitem',
];

/** Roles that can be selected (aria-selected) */
export const SELECTABLE_ROLES: string[] = [
  'option',
  'tab',
  'treeitem',
  'row',
  'cell',
];

/** Elements that are implicitly interactive */
export const INTERACTIVE_TAGS: string[] = [
  'A',
  'BUTTON',
  'INPUT',
  'SELECT',
  'TEXTAREA',
];

/** Maps HTML tag names to their implicit ARIA roles */
export const TAG_TO_ROLE: Record<string, string> = {
  A: 'link',
  BUTTON: 'button',
  INPUT: 'textbox',
  SELECT: 'combobox',
  TEXTAREA: 'textbox',
  IMG: 'img',
  H1: 'heading',
  H2: 'heading',
  H3: 'heading',
  H4: 'heading',
  H5: 'heading',
  H6: 'heading',
  NAV: 'navigation',
  MAIN: 'main',
  ASIDE: 'complementary',
  HEADER: 'banner',
  FOOTER: 'contentinfo',
  FORM: 'form',
  TABLE: 'table',
  TR: 'row',
  TH: 'columnheader',
  TD: 'cell',
  UL: 'list',
  OL: 'list',
  LI: 'listitem',
  ARTICLE: 'article',
  SECTION: 'region',
};
