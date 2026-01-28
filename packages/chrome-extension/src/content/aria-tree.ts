/**
 * Builds an accessibility tree from the DOM.
 * Captures element roles, names, and states for AI consumption.
 *
 * Generates element references (refs) that can be used with browser automation tools.
 * Ref format: s{generation}e{index} (e.g., "s1e42")
 */

import type { AriaNode, Snapshot } from '@inspector-jake/shared';
import { buildSelector } from './selector';
import {
  CHECKABLE_ROLES,
  DISABLEABLE_ROLES,
  EXPANDABLE_ROLES,
  SELECTABLE_ROLES,
  INTERACTIVE_TAGS,
  TAG_TO_ROLE,
} from './aria/roles';

// Configuration
const MAX_SNAPSHOT_AGE_MS = 30000; // 30 seconds
const MAX_NAME_LENGTH = 500;

let currentGeneration = 0;
let currentSnapshot: Snapshot | null = null;

/**
 * Generate a fresh accessibility snapshot of the document.
 */
export function generateSnapshot(): Snapshot {
  currentGeneration++;
  const elements = new Map<number, Element>();
  let elementIndex = 0;

  const assignRef = (element: Element): number => {
    const index = ++elementIndex;
    elements.set(index, element);
    return index;
  };

  const root = buildAriaTree(document.body, assignRef);

  currentSnapshot = {
    generation: currentGeneration,
    elements,
    root,
    timestamp: Date.now(),
  };

  return currentSnapshot;
}

/**
 * Get the current snapshot if it's still fresh.
 */
export function getCurrentSnapshot(): Snapshot | null {
  if (!currentSnapshot) {
    return null;
  }

  const age = Date.now() - currentSnapshot.timestamp;
  if (age > MAX_SNAPSHOT_AGE_MS) {
    return null;
  }

  return currentSnapshot;
}

/**
 * Get an element by its reference string.
 */
export function getElementByRef(ref: string): Element | null {
  const match = ref.match(/^s(\d+)e(\d+)$/);
  if (!match) {
    return null;
  }

  const [, genStr, idStr] = match;
  const generation = parseInt(genStr, 10);
  const elementId = parseInt(idStr, 10);

  if (!currentSnapshot || currentSnapshot.generation !== generation) {
    return null;
  }

  return currentSnapshot.elements.get(elementId) || null;
}

/**
 * Get current generation number.
 */
export function getCurrentGeneration(): number {
  return currentGeneration;
}

/**
 * Build the ARIA tree recursively.
 */
function buildAriaTree(
  element: Element,
  assignRef: (el: Element) => number
): AriaNode {
  const role = getElementRole(element);
  const name = getAccessibleName(element);
  const ref = `s${currentGeneration}e${assignRef(element)}`;

  const node: AriaNode = {
    role,
    name: truncateName(name),
    ref,
    children: [],
    props: {},
  };

  // Add state properties
  addStateProps(element, role, node);

  // Add URL for links
  if (role === 'link' && element instanceof HTMLAnchorElement) {
    node.props.url = element.href;
  }

  // Process children
  for (const child of element.children) {
    if (shouldSkipElement(child)) {
      continue;
    }

    const childRole = getElementRole(child);

    // Skip elements with no semantic role
    if (childRole === 'generic' && !hasInteractiveDescendants(child)) {
      // Flatten generic containers
      const grandchildren = buildChildrenList(child, assignRef);
      node.children.push(...grandchildren);
    } else {
      const childNode = buildAriaTree(child, assignRef);
      node.children.push(childNode);
    }
  }

  // Add text content for leaf nodes
  if (node.children.length === 0 && !name) {
    const text = getDirectTextContent(element);
    if (text) {
      node.children.push(text);
    }
  }

  return node;
}

/**
 * Build children list for an element.
 */
function buildChildrenList(
  element: Element,
  assignRef: (el: Element) => number
): (AriaNode | string)[] {
  const children: (AriaNode | string)[] = [];

  for (const child of element.children) {
    if (shouldSkipElement(child)) {
      continue;
    }

    const childRole = getElementRole(child);
    if (childRole === 'generic' && !hasInteractiveDescendants(child)) {
      children.push(...buildChildrenList(child, assignRef));
    } else {
      children.push(buildAriaTree(child, assignRef));
    }
  }

  return children;
}

/**
 * Get the ARIA role for an element.
 */
function getElementRole(element: Element): string {
  // Explicit role takes precedence
  const explicitRole = element.getAttribute('role');
  if (explicitRole && explicitRole !== 'presentation' && explicitRole !== 'none') {
    return explicitRole;
  }

  // Skip presentational elements
  if (explicitRole === 'presentation' || explicitRole === 'none') {
    return 'generic';
  }

  // Map tag to role
  const tagRole = TAG_TO_ROLE[element.tagName];
  if (tagRole) {
    // Special handling for input types
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

  // Check if element is interactive via click handlers or tabindex
  if (element.hasAttribute('onclick') || element.hasAttribute('tabindex')) {
    return 'button';
  }

  return 'generic';
}

/**
 * Get the accessible name for an element.
 */
function getAccessibleName(element: Element): string {
  // aria-label
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) {
    return ariaLabel.trim();
  }

  // aria-labelledby
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const labelParts = labelledBy.split(/\s+/).map(id => {
      const labelEl = document.getElementById(id);
      return labelEl?.textContent?.trim() || '';
    });
    const combined = labelParts.filter(Boolean).join(' ');
    if (combined) {
      return combined;
    }
  }

  // title attribute
  const title = element.getAttribute('title');
  if (title) {
    return title.trim();
  }

  // alt for images
  if (element instanceof HTMLImageElement) {
    return element.alt;
  }

  // placeholder for inputs
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    if (element.placeholder) {
      return element.placeholder;
    }
  }

  // label element for form controls
  if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) {
    const id = element.id;
    if (id) {
      const label = document.querySelector(`label[for="${id}"]`);
      if (label) {
        return label.textContent?.trim() || '';
      }
    }
  }

  // Text content for buttons and links
  if (element.tagName === 'BUTTON' || element.tagName === 'A') {
    return getDirectTextContent(element);
  }

  // Heading text
  if (/^H[1-6]$/.test(element.tagName)) {
    return element.textContent?.trim() || '';
  }

  return '';
}

/**
 * Get direct text content (not from children).
 */
function getDirectTextContent(element: Element): string {
  let text = '';
  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent || '';
    }
  }
  return text.trim();
}

/**
 * Add state properties to a node.
 */
function addStateProps(element: Element, role: string, node: AriaNode): void {
  // Checked state
  if (CHECKABLE_ROLES.includes(role)) {
    const checked = element.getAttribute('aria-checked');
    if (checked === 'mixed') {
      node.checked = 'mixed';
    } else if (checked === 'true' || (element as HTMLInputElement).checked) {
      node.checked = true;
    }
  }

  // Disabled state
  if (DISABLEABLE_ROLES.includes(role)) {
    if (
      element.getAttribute('aria-disabled') === 'true' ||
      (element as HTMLInputElement).disabled
    ) {
      node.disabled = true;
    }
  }

  // Expanded state
  if (EXPANDABLE_ROLES.includes(role)) {
    const expanded = element.getAttribute('aria-expanded');
    if (expanded === 'true') {
      node.expanded = true;
    }
  }

  // Selected state
  if (SELECTABLE_ROLES.includes(role)) {
    const selected = element.getAttribute('aria-selected');
    if (selected === 'true') {
      node.selected = true;
    }
  }

  // Level for headings
  if (role === 'heading') {
    const ariaLevel = element.getAttribute('aria-level');
    if (ariaLevel) {
      node.level = parseInt(ariaLevel, 10);
    } else if (/^H([1-6])$/.test(element.tagName)) {
      node.level = parseInt(element.tagName[1], 10);
    }
  }
}

/**
 * Check if element should be skipped.
 */
function shouldSkipElement(element: Element): boolean {
  // Skip hidden elements
  if (element instanceof HTMLElement) {
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') {
      return true;
    }
    if (element.hidden) {
      return true;
    }
  }

  // Skip aria-hidden
  if (element.getAttribute('aria-hidden') === 'true') {
    return true;
  }

  // Skip script and style
  if (element.tagName === 'SCRIPT' || element.tagName === 'STYLE' || element.tagName === 'NOSCRIPT') {
    return true;
  }

  return false;
}

/**
 * Check if element has interactive descendants.
 */
function hasInteractiveDescendants(element: Element): boolean {
  for (const tag of INTERACTIVE_TAGS) {
    if (element.querySelector(tag)) {
      return true;
    }
  }

  if (element.querySelector('[role]')) {
    return true;
  }

  if (element.querySelector('[tabindex]')) {
    return true;
  }

  return false;
}

/**
 * Truncate name to max length.
 */
function truncateName(name: string): string {
  if (name.length <= MAX_NAME_LENGTH) {
    return name;
  }
  return name.slice(0, MAX_NAME_LENGTH - 3) + '...';
}

/**
 * Format snapshot as YAML-like text for AI consumption.
 */
export function formatSnapshotAsText(snapshot: Snapshot): string {
  const lines: string[] = [];
  formatNode(snapshot.root, lines, 0, snapshot);
  return lines.join('\n');
}

/**
 * Extract element index from ref string (e.g., "s1e42" -> 42)
 */
function getElementIndexFromRef(ref: string): number | null {
  const match = ref.match(/^s\d+e(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Build CSS selector for an element from the snapshot.
 * Returns null if element not found or selector fails.
 */
function buildCssSelector(ref: string, snapshot: Snapshot): string | null {
  const index = getElementIndexFromRef(ref);
  if (index === null) return null;

  const element = snapshot.elements.get(index);
  if (!element) return null;

  try {
    return buildSelector(element);
  } catch {
    return null;
  }
}

function formatNode(node: AriaNode | string, lines: string[], indent: number, snapshot: Snapshot): void {
  const prefix = '  '.repeat(indent);

  if (typeof node === 'string') {
    const trimmed = node.trim();
    if (trimmed) {
      lines.push(`${prefix}- text: "${escapeText(trimmed)}"`);
    }
    return;
  }

  // Skip generic with no name
  if (node.role === 'generic' && !node.name) {
    for (const child of node.children) {
      formatNode(child, lines, indent, snapshot);
    }
    return;
  }

  let line = `${prefix}- ${node.role}`;

  if (node.name) {
    line += ` "${escapeText(node.name)}"`;
  }

  // Add state flags
  if (node.checked === true) line += ' [checked]';
  if (node.checked === 'mixed') line += ' [checked=mixed]';
  if (node.disabled) line += ' [disabled]';
  if (node.expanded) line += ' [expanded]';
  if (node.selected) line += ' [selected]';
  if (node.level) line += ` [level=${node.level}]`;

  // Add ref with CSS selector
  const cssSelector = buildCssSelector(node.ref, snapshot);
  if (cssSelector) {
    line += ` [${node.ref}|${cssSelector}]`;
  } else {
    line += ` [${node.ref}]`;
  }

  // Handle children
  if (node.children.length === 0 && Object.keys(node.props).length === 0) {
    lines.push(line);
  } else if (node.children.length === 1 && typeof node.children[0] === 'string' && Object.keys(node.props).length === 0) {
    const text = (node.children[0] as string).trim();
    if (text && text !== node.name) {
      lines.push(`${line}: "${escapeText(text)}"`);
    } else {
      lines.push(line);
    }
  } else {
    lines.push(`${line}:`);

    // Add props
    for (const [key, value] of Object.entries(node.props)) {
      lines.push(`${prefix}  - /${key}: ${JSON.stringify(value)}`);
    }

    // Add children
    for (const child of node.children) {
      formatNode(child, lines, indent + 1, snapshot);
    }
  }
}

function escapeText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}
