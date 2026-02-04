// Persistent settings for Inspector Jake DevTools panel.
// Manages computed styles mode with chrome.storage.local persistence.

import { ref, watch } from 'vue';
import { ComputedStylesMode } from '@inspector-jake/shared';

const STORAGE_KEY = 'computedStylesMode';

const computedStylesMode = ref<ComputedStylesMode>(ComputedStylesMode.LEAN);

// Load persisted mode on init
chrome.storage.local.get(STORAGE_KEY).then((result) => {
  if (result[STORAGE_KEY]) {
    computedStylesMode.value = result[STORAGE_KEY];
  }
});

// Persist on change and notify background to update content script
watch(computedStylesMode, async (mode) => {
  await chrome.storage.local.set({ [STORAGE_KEY]: mode });
  chrome.runtime.sendMessage({ type: 'SET_COMPUTED_STYLES_MODE', mode }).catch(() => {});
});

export function useSettings() {
  return { computedStylesMode };
}
