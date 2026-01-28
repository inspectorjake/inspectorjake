/**
 * Builds unique CSS selectors for DOM elements.
 * Prioritizes stable, semantic selectors over position-based ones.
 *
 * Used by the ARIA tree builder to generate selectors for element references.
 */

// Attributes to use for selectors (in priority order)
const SELECTOR_ATTRIBUTES = [
  'data-testid',
  'data-test-id',
  'data-test',
  'aria-label',
  'name',
  'id',
  'placeholder',
  'title',
  'alt',
  'role',
  'type',
];

/**
 * Build a unique CSS selector for an element.
 * Returns the shortest selector that uniquely identifies the element.
 */
export function buildSelector(element: Element): string {
  // Try simple strategies first
  const simple = trySimpleSelector(element);
  if (simple && isUnique(simple)) {
    return simple;
  }

  // Build path from element to root
  const path = buildSelectorPath(element);
  return path;
}

/**
 * Try to build a simple, single-part selector.
 */
function trySimpleSelector(element: Element): string | null {
  // Try ID (if it doesn't look auto-generated)
  const id = element.getAttribute('id');
  if (id && isStableId(id)) {
    return `#${escapeSelector(id)}`;
  }

  // Try data-testid
  for (const attr of ['data-testid', 'data-test-id', 'data-test']) {
    const value = element.getAttribute(attr);
    if (value) {
      return `[${attr}="${escapeSelector(value)}"]`;
    }
  }

  // Try unique aria-label
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel && isStableText(ariaLabel)) {
    const selector = `[aria-label="${escapeSelector(ariaLabel)}"]`;
    if (isUnique(selector)) {
      return selector;
    }
  }

  // Try unique name attribute
  const name = element.getAttribute('name');
  if (name) {
    const selector = `[name="${escapeSelector(name)}"]`;
    if (isUnique(selector)) {
      return selector;
    }
  }

  return null;
}

/**
 * Build a selector path from element up to a unique ancestor.
 */
function buildSelectorPath(element: Element): string {
  const parts: string[] = [];
  let current: Element | null = element;
  let attempts = 0;
  const maxAttempts = 10;

  while (current && attempts < maxAttempts) {
    const part = buildElementSelector(current);
    parts.unshift(part);

    // Check if current path is unique
    const selector = parts.join(' > ');
    if (isUnique(selector)) {
      return selector;
    }

    current = current.parentElement;
    attempts++;
  }

  // Fall back to full path if nothing is unique
  return parts.join(' > ');
}

/**
 * Build a selector for a single element.
 */
function buildElementSelector(element: Element): string {
  const tag = element.tagName.toLowerCase();

  // Try attribute-based selectors first
  for (const attr of SELECTOR_ATTRIBUTES) {
    const value = element.getAttribute(attr);
    if (value && isStableValue(attr, value)) {
      return `${tag}[${attr}="${escapeSelector(value)}"]`;
    }
  }

  // Try class-based selector
  const classes = getStableClasses(element);
  if (classes.length > 0) {
    const classSelector = classes.map(c => `.${escapeSelector(c)}`).join('');
    const fullSelector = `${tag}${classSelector}`;
    if (isUniqueAmongSiblings(element, fullSelector)) {
      return fullSelector;
    }
  }

  // Fall back to nth-of-type
  const index = getNthOfType(element);
  return `${tag}:nth-of-type(${index})`;
}

/**
 * Get the nth-of-type index for an element.
 */
function getNthOfType(element: Element): number {
  const parent = element.parentElement;
  if (!parent) {
    return 1;
  }

  const siblings = Array.from(parent.children).filter(
    child => child.tagName === element.tagName
  );

  return siblings.indexOf(element) + 1;
}

/**
 * Check if a selector is unique in the document.
 */
function isUnique(selector: string): boolean {
  try {
    const matches = document.querySelectorAll(selector);
    return matches.length === 1;
  } catch {
    return false;
  }
}

/**
 * Check if a selector is unique among siblings.
 */
function isUniqueAmongSiblings(element: Element, selector: string): boolean {
  const parent = element.parentElement;
  if (!parent) {
    return true;
  }

  try {
    const matches = parent.querySelectorAll(`:scope > ${selector}`);
    return matches.length === 1;
  } catch {
    return false;
  }
}

/**
 * Check if an ID looks stable (not auto-generated).
 */
function isStableId(id: string): boolean {
  // Skip IDs that look auto-generated
  if (/^[a-f0-9]{8,}$/i.test(id)) return false;
  if (/^(ember|react|vue|ng|_|:)/.test(id)) return false;
  if (/\d{5,}/.test(id)) return false;
  if (id.includes('--')) return false;
  return true;
}

/**
 * Check if text is stable (not likely to change).
 */
function isStableText(text: string): boolean {
  // Skip text with many numbers (likely dynamic)
  const numberCount = (text.match(/\d/g) || []).length;
  if (numberCount > 3) return false;

  // Skip very short text
  if (text.length < 2) return false;

  // Skip text that's too long
  if (text.length > 100) return false;

  return true;
}

/**
 * Check if an attribute value is stable.
 */
function isStableValue(attr: string, value: string): boolean {
  // data-test* values are always stable
  if (attr.startsWith('data-test')) {
    return true;
  }

  // IDs might be auto-generated
  if (attr === 'id') {
    return isStableId(value);
  }

  // Text attributes should be stable
  if (['aria-label', 'title', 'placeholder', 'alt'].includes(attr)) {
    return isStableText(value);
  }

  return true;
}

/**
 * Get stable CSS classes from an element.
 */
function getStableClasses(element: Element): string[] {
  const classes = Array.from(element.classList);

  return classes.filter(cls => {
    // Skip utility classes from frameworks
    if (/^(hover:|focus:|active:|sm:|md:|lg:|xl:)/.test(cls)) return false;

    // Skip classes with many numbers
    if (/\d{4,}/.test(cls)) return false;

    // Skip hash-like classes (CSS modules)
    if (/^[a-z]+_[a-zA-Z0-9]{5,}$/.test(cls)) return false;
    if (/^_[a-zA-Z0-9]{6,}$/.test(cls)) return false;

    // Skip single-letter classes
    if (cls.length === 1) return false;

    return true;
  }).slice(0, 3); // Limit to 3 classes
}

/**
 * Escape a string for use in a CSS selector.
 */
function escapeSelector(str: string): string {
  return str.replace(/["\\]/g, '\\$&');
}

/**
 * Find an element using a selector with retry.
 */
export async function findElement(
  selector: string,
  options: {
    timeout?: number;
    visible?: boolean;
    clickable?: boolean;
  } = {}
): Promise<Element> {
  const { timeout = 5000, visible = false, clickable = false } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const element = document.querySelector(selector);

    if (element) {
      if (visible && !isElementVisible(element)) {
        await sleep(100);
        continue;
      }

      if (clickable && !isElementClickable(element)) {
        await sleep(100);
        continue;
      }

      return element;
    }

    await sleep(100);
  }

  throw new Error(`Element not found: ${selector}`);
}

/**
 * Check if an element is visible.
 */
export function isElementVisible(element: Element): boolean {
  if (!(element instanceof HTMLElement)) {
    return true;
  }

  const style = window.getComputedStyle(element);

  if (style.display === 'none') return false;
  if (style.visibility === 'hidden') return false;
  if (style.opacity === '0') return false;

  const rect = element.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;

  return true;
}

/**
 * Check if an element is clickable (not covered by another element).
 */
export function isElementClickable(element: Element): boolean {
  if (!isElementVisible(element)) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  const topElement = document.elementFromPoint(centerX, centerY);

  if (!topElement) {
    return false;
  }

  return element === topElement || element.contains(topElement);
}

/**
 * Get the center coordinates of an element.
 */
export function getElementCenter(element: Element): { x: number; y: number } {
  const rect = element.getBoundingClientRect();
  return {
    x: Math.round(rect.left + rect.width / 2),
    y: Math.round(rect.top + rect.height / 2),
  };
}

/**
 * Scroll an element into view.
 */
export async function scrollIntoView(element: Element): Promise<void> {
  element.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
    inline: 'center',
  });

  // Wait for scroll to complete
  await sleep(300);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
