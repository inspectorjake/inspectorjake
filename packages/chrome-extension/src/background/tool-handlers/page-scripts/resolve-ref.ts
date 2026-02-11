/**
 * Page-context functions for resolving element refs.
 *
 * These functions are passed to chrome.scripting.executeScript and run
 * in the web page context. They MUST be self-contained — no closures
 * over module-level variables or imports.
 */

/**
 * Resolve an element from a ref string (e.g. "s1e42") or CSS selector.
 * Returns the element or null.
 *
 * Self-contained for use with chrome.scripting.executeScript.
 */
export function resolveRefOrSelector(
  ref: string | null,
  selector: string | null
): Element | null {
  let element: Element | null = null;

  if (ref) {
    const elementMap = (window as any).__ariaElementMap as Map<number, Element> | undefined;
    const currentGen = (window as any).__ariaCurrentGeneration as number | undefined;

    if (elementMap) {
      const match = ref.match(/^s(\d+)e(\d+)$/);
      if (match) {
        const [, genStr, idStr] = match;
        const generation = parseInt(genStr, 10);
        const elementId = parseInt(idStr, 10);
        if (currentGen === generation) {
          element = elementMap.get(elementId) || null;
        }
      }
    }
  }

  if (!element && selector) {
    element = document.querySelector(selector);
  }

  return element;
}

/**
 * Resolve an element and return its DPR-scaled bounding rect.
 * Used by screenshot handlers.
 *
 * Self-contained for use with chrome.scripting.executeScript.
 */
export function resolveRefToScaledRect(
  ref: string | null,
  selector: string | null
): { x: number; y: number; width: number; height: number } | null {
  const resolveElement = (r: string | null, s: string | null): Element | null => {
    let el: Element | null = null;

    if (r) {
      const elementMap = (window as any).__ariaElementMap as Map<number, Element> | undefined;
      const currentGen = (window as any).__ariaCurrentGeneration as number | undefined;

      if (elementMap) {
        const match = r.match(/^s(\d+)e(\d+)$/);
        if (match) {
          const [, genStr, idStr] = match;
          const generation = parseInt(genStr, 10);
          const elementId = parseInt(idStr, 10);
          if (currentGen === generation) {
            el = elementMap.get(elementId) || null;
          }
        }
      }
    }

    if (!el && s) {
      el = document.querySelector(s);
    }

    return el;
  };

  const element = resolveElement(ref, selector);
  if (!element) return null;

  const rect = element.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  return {
    x: Math.round(rect.x * dpr),
    y: Math.round(rect.y * dpr),
    width: Math.round(rect.width * dpr),
    height: Math.round(rect.height * dpr),
  };
}

/**
 * Resolve an element, scroll it into view, and return its center coordinates.
 * Used by click handlers.
 *
 * Self-contained for use with chrome.scripting.executeScript.
 */
export function resolveRefAndGetCenter(
  ref: string | null,
  selector: string | null
): { x: number; y: number } | { error: string } {
  let element: Element | null = null;

  if (ref) {
    const elementMap = (window as any).__ariaElementMap as Map<number, Element> | undefined;
    const currentGen = (window as any).__ariaCurrentGeneration as number | undefined;

    if (elementMap) {
      const match = ref.match(/^s(\d+)e(\d+)$/);
      if (match) {
        const [, genStr, idStr] = match;
        const generation = parseInt(genStr, 10);
        const elementId = parseInt(idStr, 10);
        if (currentGen === generation) {
          element = elementMap.get(elementId) || null;
        }
      }
    }
  }

  if (!element && selector) {
    element = document.querySelector(selector);
  }

  if (!element) {
    return { error: 'Element not found' };
  }

  element.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
  const rect = element.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

/**
 * Resolve an element, focus it, and optionally clear its value.
 * Used by type handlers.
 *
 * Self-contained for use with chrome.scripting.executeScript.
 */
export function resolveRefAndFocus(
  ref: string | null,
  selector: string | null,
  clear: boolean
): void {
  let element: Element | null = null;

  if (ref) {
    const elementMap = (window as any).__ariaElementMap as Map<number, Element> | undefined;
    const currentGen = (window as any).__ariaCurrentGeneration as number | undefined;

    if (elementMap) {
      const match = ref.match(/^s(\d+)e(\d+)$/);
      if (match) {
        const [, genStr, idStr] = match;
        const generation = parseInt(genStr, 10);
        const elementId = parseInt(idStr, 10);
        if (currentGen === generation) {
          element = elementMap.get(elementId) || null;
        }
      }
    }
  }

  if (!element && selector) {
    element = document.querySelector(selector);
  }

  if (element instanceof HTMLElement) {
    element.focus();
    if (clear && (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
      element.value = '';
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
}

/**
 * Resolve an element and set its value (synthetic typing fallback).
 * Used by type handlers when CDP is unavailable.
 *
 * Self-contained for use with chrome.scripting.executeScript.
 */
export function resolveRefAndSetValue(
  ref: string | null,
  selector: string | null,
  text: string
): void {
  let element: Element | null = null;

  if (ref) {
    const elementMap = (window as any).__ariaElementMap as Map<number, Element> | undefined;
    const currentGen = (window as any).__ariaCurrentGeneration as number | undefined;

    if (elementMap) {
      const match = ref.match(/^s(\d+)e(\d+)$/);
      if (match) {
        const [, genStr, idStr] = match;
        const generation = parseInt(genStr, 10);
        const elementId = parseInt(idStr, 10);
        if (currentGen === generation) {
          element = elementMap.get(elementId) || null;
        }
      }
    }
  }

  if (!element && selector) {
    element = document.querySelector(selector);
  }

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    element.value += text;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

/**
 * Resolve an element and click it synthetically.
 * Used by click handlers when CDP is unavailable.
 *
 * Self-contained for use with chrome.scripting.executeScript.
 */
export function resolveRefAndClick(
  ref: string | null,
  selector: string | null,
  _button: string,
  clickCount: number
): void {
  let element: Element | null = null;

  if (ref) {
    const elementMap = (window as any).__ariaElementMap as Map<number, Element> | undefined;
    const currentGen = (window as any).__ariaCurrentGeneration as number | undefined;

    if (elementMap) {
      const match = ref.match(/^s(\d+)e(\d+)$/);
      if (match) {
        const [, genStr, idStr] = match;
        const generation = parseInt(genStr, 10);
        const elementId = parseInt(idStr, 10);
        if (currentGen === generation) {
          element = elementMap.get(elementId) || null;
        }
      }
    }
  }

  if (!element && selector) {
    element = document.querySelector(selector);
  }

  if (element instanceof HTMLElement) {
    for (let i = 0; i < clickCount; i++) {
      element.click();
    }
  }
}

/**
 * Resolve a <select> element and choose an option by value, label, or index.
 *
 * Self-contained for use with chrome.scripting.executeScript.
 */
export function resolveRefAndSelectOption(
  ref: string | null,
  selector: string | null,
  value: string | null,
  label: string | null,
  index: number | null
): { success: true; selectedValue: string; selectedLabel: string } | { error: string } {
  let element: Element | null = null;

  if (ref) {
    const elementMap = (window as any).__ariaElementMap as Map<number, Element> | undefined;
    const currentGen = (window as any).__ariaCurrentGeneration as number | undefined;

    if (elementMap) {
      const match = ref.match(/^s(\d+)e(\d+)$/);
      if (match) {
        const [, genStr, idStr] = match;
        const generation = parseInt(genStr, 10);
        const elementId = parseInt(idStr, 10);
        if (currentGen === generation) {
          element = elementMap.get(elementId) || null;
        }
      }
    }
  }

  if (!element && selector) {
    element = document.querySelector(selector);
  }

  if (!(element instanceof HTMLSelectElement)) {
    return { error: 'Element is not a select' };
  }

  const selectEl = element;
  let selectedOption: HTMLOptionElement | null = null;

  if (value !== null) {
    selectedOption = Array.from(selectEl.options).find(o => o.value === value) || null;
  } else if (label !== null) {
    selectedOption = Array.from(selectEl.options).find(o => o.text === label || o.label === label) || null;
  } else if (index !== null) {
    selectedOption = selectEl.options[index] || null;
  }

  if (!selectedOption) {
    return { error: 'Option not found' };
  }

  selectEl.value = selectedOption.value;
  selectEl.dispatchEvent(new Event('change', { bubbles: true }));

  return { success: true, selectedValue: selectedOption.value, selectedLabel: selectedOption.text };
}
