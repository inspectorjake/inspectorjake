/**
 * Vitest configuration for chrome-extension package.
 * Excludes dist folder and sets up Vue/DOM testing environment.
 */
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['dist/**/*', 'node_modules/**/*'],
    environment: 'happy-dom',
    globals: true,
  },
});
