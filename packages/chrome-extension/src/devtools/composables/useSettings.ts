// Persistent settings for Inspector Jake DevTools panel.
// Manages computed styles mode and screenshot dimension cap with chrome.storage.local persistence.

import { ref, watch } from 'vue';
import { ComputedStylesMode } from '@inspector-jake/shared';

const STORAGE_KEY_STYLES = 'computedStylesMode';
const STORAGE_KEY_MAX_DIM = 'maxScreenshotDimension';
const STORAGE_KEY_AUTO_CLEAR = 'autoClearSelectionsAfterSeen';
const DEFAULT_MAX_DIMENSION = 800;

const computedStylesMode = ref<ComputedStylesMode>(ComputedStylesMode.LEAN);
const maxScreenshotDimension = ref<number>(DEFAULT_MAX_DIMENSION);
const autoClearSelectionsAfterSeen = ref<boolean>(true);

// Load persisted settings on init
chrome.storage.local.get([STORAGE_KEY_STYLES, STORAGE_KEY_MAX_DIM, STORAGE_KEY_AUTO_CLEAR]).then((result) => {
  if (result[STORAGE_KEY_STYLES]) {
    computedStylesMode.value = result[STORAGE_KEY_STYLES];
  }
  if (result[STORAGE_KEY_MAX_DIM]) {
    maxScreenshotDimension.value = result[STORAGE_KEY_MAX_DIM];
  }
  if (typeof result[STORAGE_KEY_AUTO_CLEAR] === 'boolean') {
    autoClearSelectionsAfterSeen.value = result[STORAGE_KEY_AUTO_CLEAR];
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

export function useSettings() {
  return {
    computedStylesMode,
    maxScreenshotDimension,
    autoClearSelectionsAfterSeen,
    setComputedStylesMode,
  };
}
