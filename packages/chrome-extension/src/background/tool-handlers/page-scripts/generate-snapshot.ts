/**
 * ARIA snapshot generator for page context.
 *
 * This function runs inside the web page via chrome.scripting.executeScript.
 * It MUST be entirely self-contained — no closures, no imports.
 */

/**
 * Generate an interactive ARIA snapshot with refs.
 * Runs in the page context via executeScript.
 *
 * Self-contained: all helpers are defined inline because executeScript
 * serializes the function and runs it in the page's JS context.
 */
export function generateInteractiveSnapshot(rootSelector: string | null): string {
  const jakesVibe = (window as any).__jakesVibe;

  const MAX_NAME_LENGTH = 500;

  const TAG_TO_ROLE: Record<string, string> = {
    A: 'link', BUTTON: 'button', INPUT: 'textbox', SELECT: 'combobox',
    TEXTAREA: 'textbox', IMG: 'img', H1: 'heading', H2: 'heading',
    H3: 'heading', H4: 'heading', H5: 'heading', H6: 'heading',
    NAV: 'navigation', MAIN: 'main', ASIDE: 'complementary',
    HEADER: 'banner', FOOTER: 'contentinfo', FORM: 'form',
    TABLE: 'table', TR: 'row', TH: 'columnheader', TD: 'cell',
    UL: 'list', OL: 'list', LI: 'listitem', ARTICLE: 'article', SECTION: 'region',
  };

  const INTERACTIVE_TAGS = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'];
  const CHECKABLE_ROLES = ['checkbox', 'radio', 'menuitemcheckbox', 'menuitemradio', 'switch'];
  const DISABLEABLE_ROLES = ['button', 'textbox', 'checkbox', 'radio', 'combobox', 'listbox', 'slider', 'spinbutton'];
  const EXPANDABLE_ROLES = ['button', 'combobox', 'listbox', 'treeitem', 'row'];
  const SELECTABLE_ROLES = ['option', 'tab', 'treeitem', 'row', 'cell'];

  (window as any).__ariaGeneration = ((window as any).__ariaGeneration || 0) + 1;
  const generation = (window as any).__ariaGeneration;

  const elementMap = new Map<number, Element>();
  (window as any).__ariaElementMap = elementMap;
  (window as any).__ariaCurrentGeneration = generation;
  let elementIndex = 0;

  function assignRef(element: Element): string {
    const index = ++elementIndex;
    elementMap.set(index, element);
    return `s${generation}e${index}`;
  }

  function getElementRole(element: Element): string {
    const explicitRole = element.getAttribute('role');
    if (explicitRole && explicitRole !== 'presentation' && explicitRole !== 'none') {
      return explicitRole;
    }
    if (explicitRole === 'presentation' || explicitRole === 'none') {
      return 'generic';
    }
    const tagRole = TAG_TO_ROLE[element.tagName];
    if (tagRole) {
      if (element.tagName === 'INPUT') {
        const type = (element as HTMLInputElement).type.toLowerCase();
        if (type === 'checkbox') return 'checkbox';
        if (type === 'radio') return 'radio';
        if (type === 'button' || type === 'submit' || type === 'reset') return 'button';
        if (type === 'range') return 'slider';
        if (type === 'number') return 'spinbutton';
        return 'textbox';
      }
      return tagRole;
    }
    if (element.hasAttribute('onclick') || element.hasAttribute('tabindex')) {
      return 'button';
    }
    return 'generic';
  }

  function getAccessibleName(element: Element): string {
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel.trim();

    const labelledBy = element.getAttribute('aria-labelledby');
    if (labelledBy) {
      const parts = labelledBy.split(/\s+/).map(id => document.getElementById(id)?.textContent?.trim() || '');
      const combined = parts.filter(Boolean).join(' ');
      if (combined) return combined;
    }

    const title = element.getAttribute('title');
    if (title) return title.trim();

    if (element instanceof HTMLImageElement) return element.alt;

    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      if (element.placeholder) return element.placeholder;
    }

    if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) {
      const id = element.id;
      if (id) {
        const label = document.querySelector(`label[for="${id}"]`);
        if (label) return label.textContent?.trim() || '';
      }
    }

    if (element.tagName === 'BUTTON' || element.tagName === 'A') {
      let text = '';
      for (const node of element.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) text += node.textContent || '';
      }
      return text.trim();
    }

    if (/^H[1-6]$/.test(element.tagName)) {
      return element.textContent?.trim() || '';
    }

    return '';
  }

  function shouldSkipElement(element: Element): boolean {
    if (element instanceof HTMLElement) {
      const style = window.getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden') return true;
      if (element.hidden) return true;
    }
    if (element.getAttribute('aria-hidden') === 'true') return true;
    if (element.tagName === 'SCRIPT' || element.tagName === 'STYLE' || element.tagName === 'NOSCRIPT') return true;
    return false;
  }

  function hasInteractiveDescendants(element: Element): boolean {
    for (const tag of INTERACTIVE_TAGS) {
      if (element.querySelector(tag)) return true;
    }
    if (element.querySelector('[role]')) return true;
    if (element.querySelector('[tabindex]')) return true;
    return false;
  }

  function buildSelector(element: Element): string {
    if (jakesVibe?.computeSelector) {
      return jakesVibe.computeSelector(element);
    }
    const tag = element.tagName.toLowerCase();
    if (element.id) return `#${CSS.escape(element.id)}`;
    const classes = Array.from(element.classList).slice(0, 2).map(c => `.${CSS.escape(c)}`).join('');
    return tag + classes;
  }

  function escapeText(text: string): string {
    return text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
  }

  function truncateName(name: string): string {
    return name.length <= MAX_NAME_LENGTH ? name : name.slice(0, MAX_NAME_LENGTH - 3) + '...';
  }

  const lines: string[] = [];

  function processNode(element: Element, depth: number): void {
    if (shouldSkipElement(element)) return;

    const role = getElementRole(element);
    const name = truncateName(getAccessibleName(element));
    const ref = assignRef(element);
    const selector = buildSelector(element);

    if (role === 'generic' && !name && !hasInteractiveDescendants(element)) {
      for (const child of element.children) {
        processNode(child, depth);
      }
      return;
    }

    const indent = '  '.repeat(depth);
    let line = `${indent}- ${role}`;

    if (name) {
      line += ` "${escapeText(name)}"`;
    }

    if (CHECKABLE_ROLES.includes(role)) {
      const checked = element.getAttribute('aria-checked');
      if (checked === 'mixed') line += ' [checked=mixed]';
      else if (checked === 'true' || (element as HTMLInputElement).checked) line += ' [checked]';
    }

    if (DISABLEABLE_ROLES.includes(role)) {
      if (element.getAttribute('aria-disabled') === 'true' || (element as HTMLInputElement).disabled) {
        line += ' [disabled]';
      }
    }

    if (EXPANDABLE_ROLES.includes(role)) {
      if (element.getAttribute('aria-expanded') === 'true') line += ' [expanded]';
    }

    if (SELECTABLE_ROLES.includes(role)) {
      if (element.getAttribute('aria-selected') === 'true') line += ' [selected]';
    }

    if (role === 'heading') {
      const ariaLevel = element.getAttribute('aria-level');
      const level = ariaLevel ? parseInt(ariaLevel, 10) : /^H([1-6])$/.test(element.tagName) ? parseInt(element.tagName[1], 10) : null;
      if (level) line += ` [level=${level}]`;
    }

    line += ` [${ref}|${selector}]`;

    lines.push(line);

    for (const child of element.children) {
      processNode(child, depth + 1);
    }
  }

  const rootElement = rootSelector ? document.querySelector(rootSelector) : document.body;
  if (!rootElement) {
    throw new Error(`Root element not found: ${rootSelector}`);
  }

  processNode(rootElement, 0);
  return lines.join('\n');
}
