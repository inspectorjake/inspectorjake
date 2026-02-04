// Preview mode entry point.
// Installs Chrome API mock before loading any components that depend on chrome.*.
import { installMockChrome } from './mock-chrome';
installMockChrome();

import '../styles/tailwind.css';

async function boot() {
  const { createApp } = await import('vue');
  const { default: Panel } = await import('../Panel.vue');
  const { default: StateController } = await import('./StateController.vue');

  createApp(Panel).mount('#app');
  createApp(StateController).mount('#state-controller');
}

boot();
