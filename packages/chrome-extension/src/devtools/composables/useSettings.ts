// Persistent settings for Inspector Jake DevTools panel.
// Manages computed styles mode and screenshot dimension cap with chrome.storage.local persistence.

import { ref, watch } from 'vue';
import { ComputedStylesMode } from '@inspector-jake/shared';

const STORAGE_KEY_STYLES = 'computedStylesMode';
const STORAGE_KEY_MAX_DIM = 'maxScreenshotDimension';
const DEFAULT_MAX_DIMENSION = 800;

const computedStylesMode = ref<ComputedStylesMode>(ComputedStylesMode.LEAN);
const maxScreenshotDimension = ref<number>(DEFAULT_MAX_DIMENSION);

// Load persisted settings on init
chrome.storage.local.get([STORAGE_KEY_STYLES, STORAGE_KEY_MAX_DIM]).then((result) => {
  if (result[STORAGE_KEY_STYLES]) {
    computedStylesMode.value = result[STORAGE_KEY_STYLES];
  }
  if (result[STORAGE_KEY_MAX_DIM]) {
    maxScreenshotDimension.value = result[STORAGE_KEY_MAX_DIM];
  }
});

// Persist on change and notify background to update content script
watch(computedStylesMode, async (mode) => {
  await chrome.storage.local.set({ [STORAGE_KEY_STYLES]: mode });
  chrome.runtime.sendMessage({ type: 'SET_COMPUTED_STYLES_MODE', mode }).catch(() => {});
});

watch(maxScreenshotDimension, async (val) => {
  await chrome.storage.local.set({ [STORAGE_KEY_MAX_DIM]: val });
});

export function useSettings() {
  return { computedStylesMode, maxScreenshotDimension };
}
