/**
 * Window API — exposes __jakesVibe utilities on the window object.
 * These are consumed by chrome.scripting.executeScript calls from the background.
 */

import {
  IMPLICIT_ROLES,
  getImplicitRole,
  computeAccessibleName,
  buildSelectorPart,
  type AccessibleNameContext,
  type SelectorContext,
} from '@inspector-jake/shared';

// ============================================================================
// A11y Path Generation (uses shared utilities)
// ============================================================================

function getAccessibleName(el: Element): string | null {
  const ctx: AccessibleNameContext = {
    tagName: el.tagName,
    getAttribute: (name) => el.getAttribute(name),
    innerText: (el as HTMLElement).innerText,
    getElementById: (id) => document.getElementById(id),
  };
  return computeAccessibleName(ctx);
}

function buildSimpleSelector(el: Element): string {
  const parent = el.parentElement;
  let siblingIndex: number | undefined;
  let siblingCount: number | undefined;

  if (parent) {
    const siblings = Array.from(parent.children).filter((s) => s.tagName === el.tagName);
    siblingCount = siblings.length;
    siblingIndex = siblings.indexOf(el) + 1;
  }

  const ctx: SelectorContext = {
    tagName: el.tagName,
    id: el.id || null,
    className: typeof el.className === 'string' ? el.className : null,
    getAttribute: (name) => el.getAttribute(name),
    siblingIndex,
    siblingCount,
  };
  return buildSelectorPart(ctx);
}

function buildA11yPath(el: Element): string {
  const path: string[] = [];
  let current: Element | null = el;

  while (current && current !== document.body && current !== document.documentElement) {
    const role = current.getAttribute('role') || getImplicitRole(current.tagName);
    const name = getAccessibleName(current);
    const selector = buildSimpleSelector(current);

    let node = `- ${role || (current.tagName || 'element').toLowerCase()}`;
    if (name) {
      const truncated = name.slice(0, 50).replace(/"/g, '\\"');
      node += ` "${truncated}"`;
    }
    node += ` [${selector}]`;

    path.unshift(node);
    current = current.parentElement;
  }

  if (path.length > 0) {
    path[path.length - 1] += ' ← SELECTED';
  }

  return path.map((line, i) => '  '.repeat(i) + line).join('\n');
}

// ============================================================================
// Window API object
// ============================================================================

const jakesVibe = {
  /**
   * Compute a unique CSS selector for an element.
   */
  computeSelector(el: Element): string {
    if (el.id) {
      return `#${CSS.escape(el.id)}`;
    }

    const path: string[] = [];
    let current: Element | null = el;

    while (current && current !== document.body) {
      let selector = (current.tagName || 'element').toLowerCase();

      if (current.className && typeof current.className === 'string') {
        const classes = current.className.trim().split(/\s+/).filter(c => c);
        if (classes.length > 0) {
          selector += '.' + classes.map(c => CSS.escape(c)).join('.');
        }
      }

      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(
          (s) => s.tagName === current!.tagName
        );
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += `:nth-of-type(${index})`;
        }
      }

      path.unshift(selector);
      current = current.parentElement;
    }

    return path.join(' > ');
  },

  /**
   * Get detailed info about an element.
   */
  getElementInfo(el: Element): any {
    const rect = el.getBoundingClientRect();

    let computedStyles: Record<string, string> | undefined;
    if (el instanceof HTMLElement) {
      const mode = (window as any).__jakesVibeComputedStylesMode || 'lean';
      const cs = window.getComputedStyle(el);
      computedStyles = {};

      const LEAN_SET = new Set([
        'display', 'position', 'top', 'right', 'bottom', 'left',
        'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
        'margin', 'padding', 'box-sizing',
        'flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'gap',
        'grid-template-columns', 'grid-template-rows',
        'background-color', 'color', 'opacity',
        'border', 'border-radius', 'box-shadow',
        'font-family', 'font-size', 'font-weight', 'line-height', 'text-align',
        'overflow', 'z-index',
      ]);

      const DEFAULTS = new Set([
        'none', 'normal', 'auto', '0px', '0', 'start', 'stretch',
        'visible', 'static', 'baseline', 'row', 'nowrap', '',
      ]);

      if (mode === 'none') {
        computedStyles = undefined;
      } else if (mode === 'lean') {
        for (const prop of LEAN_SET) {
          computedStyles[prop] = cs.getPropertyValue(prop);
        }
      } else {
        for (let i = 0; i < cs.length; i++) {
          const prop = cs[i];
          const value = cs.getPropertyValue(prop);
          const isLean = LEAN_SET.has(prop);

          if (mode === 'all') {
            computedStyles[prop] = value;
          } else {
            if (isLean || !DEFAULTS.has(value)) {
              computedStyles[prop] = value;
            }
          }
        }
      }
    }

    return {
      tagName: (el.tagName || 'element').toLowerCase(),
      id: el.id || null,
      className: el.className || null,
      selector: this.computeSelector(el),
      a11yPath: buildA11yPath(el),
      innerText: (el as HTMLElement).innerText?.slice(0, 200) || null,
      attributes: Array.from(el.attributes).map((a) => ({
        name: a.name,
        value: a.value,
      })),
      computedStyles,
      rect: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
      },
    };
  },
};

// Expose on window
(window as any).__jakesVibe = jakesVibe;

// Backwards compatibility aliases
(window as any).__vibeJake = jakesVibe;
(window as any).__inspectorJake = jakesVibe;
