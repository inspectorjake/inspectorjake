// Persistent settings for Inspector Jake DevTools panel.
// Manages computed styles mode and screenshot dimension cap with chrome.storage.local persistence.

import { ref, watch } from 'vue';
import { ComputedStylesMode } from '@inspector-jake/shared';

const STORAGE_KEY_STYLES = 'computedStylesMode';
const STORAGE_KEY_MAX_DIM = 'maxScreenshotDimension';
const STORAGE_KEY_AUTO_CLEAR = 'autoClearSelectionsAfterSeen';
const STORAGE_KEY_ACCENT = 'accentColor';
const DEFAULT_MAX_DIMENSION = 800;

/**
 * Accent colors. `tint` colors text and icons, `fill` backs filled buttons and
 * chat bubbles, and `on` is the text color on `fill` (each pair passes 4.5:1).
 */
export const ACCENTS = {
  blue: { label: 'Blue', tint: '#0A84FF', fill: '#0063D6', on: '#FFFFFF' },
  lime: { label: 'Lime', tint: '#BEF264', fill: '#BEF264', on: '#1C1C1E' },
  purple: { label: 'Purple', tint: '#BF5AF2', fill: '#8E3CC0', on: '#FFFFFF' },
  orange: { label: 'Orange', tint: '#FF9F0A', fill: '#FF9F0A', on: '#1C1C1E' },
} as const;
export type AccentName = keyof typeof ACCENTS;

function isAccentName(value: unknown): value is AccentName {
  return typeof value === 'string' && Object.hasOwn(ACCENTS, value);
}

/** Point the theme's tint variables at an accent. */
function applyAccent(name: AccentName): void {
  const accent = ACCENTS[name];
  const style = document.documentElement.style;
  style.setProperty('--color-tint', accent.tint);
  style.setProperty('--color-tint-fill', accent.fill);
  style.setProperty('--color-on-tint', accent.on);
}

const computedStylesMode = ref<ComputedStylesMode>(ComputedStylesMode.LEAN);
const maxScreenshotDimension = ref<number>(DEFAULT_MAX_DIMENSION);
const autoClearSelectionsAfterSeen = ref<boolean>(true);
const accent = ref<AccentName>('blue');

// Load persisted settings on init
chrome.storage.local.get([STORAGE_KEY_STYLES, STORAGE_KEY_MAX_DIM, STORAGE_KEY_AUTO_CLEAR, STORAGE_KEY_ACCENT]).then((result) => {
  if (result[STORAGE_KEY_STYLES]) {
    computedStylesMode.value = result[STORAGE_KEY_STYLES];
  }
  if (result[STORAGE_KEY_MAX_DIM]) {
    maxScreenshotDimension.value = result[STORAGE_KEY_MAX_DIM];
  }
  if (typeof result[STORAGE_KEY_AUTO_CLEAR] === 'boolean') {
    autoClearSelectionsAfterSeen.value = result[STORAGE_KEY_AUTO_CLEAR];
  }
  if (isAccentName(result[STORAGE_KEY_ACCENT])) {
    accent.value = result[STORAGE_KEY_ACCENT];
  }
});

async function setComputedStylesMode(mode: ComputedStylesMode): Promise<boolean> {
  computedStylesMode.value = mode;
  await chrome.storage.local.set({ [STORAGE_KEY_STYLES]: mode });

  try {
    const response = await chrome.runtime.sendMessage({ type: 'SET_COMPUTED_STYLES_MODE', mode });
    return response?.success !== false;
  } catch {
    return false;
  }
}

watch(maxScreenshotDimension, async (val) => {
  await chrome.storage.local.set({ [STORAGE_KEY_MAX_DIM]: val });
});

watch(autoClearSelectionsAfterSeen, async (val) => {
  await chrome.storage.local.set({ [STORAGE_KEY_AUTO_CLEAR]: val });
});

watch(accent, async (val) => {
  applyAccent(val);
  await chrome.storage.local.set({ [STORAGE_KEY_ACCENT]: val });
});

applyAccent(accent.value);

export function useSettings() {
  return {
    computedStylesMode,
    maxScreenshotDimension,
    autoClearSelectionsAfterSeen,
    accent,
    setComputedStylesMode,
  };
}
