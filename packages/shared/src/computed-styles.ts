// Computed styles configuration for element selections.
// Defines modes, curated property lists, and default value filters.

export enum ComputedStylesMode {
  ALL = 'all',
  NON_DEFAULT = 'non-default',
  LEAN = 'lean',
}

export const LEAN_PROPERTIES = [
  // Layout
  'display', 'position', 'top', 'right', 'bottom', 'left',
  'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
  'margin', 'padding', 'box-sizing',
  // Flexbox/Grid
  'flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'gap',
  'grid-template-columns', 'grid-template-rows',
  // Visual
  'background-color', 'color', 'opacity',
  'border', 'border-radius', 'box-shadow',
  // Typography
  'font-family', 'font-size', 'font-weight', 'line-height', 'text-align',
  // Other
  'overflow', 'z-index',
] as const;

export const DEFAULT_FILTER_VALUES = new Set([
  'none', 'normal', 'auto', '0px', '0', 'start', 'stretch',
  'visible', 'static', 'baseline', 'row', 'nowrap', '',
]);
