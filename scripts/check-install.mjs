#!/usr/bin/env node
/**
 * Runs before `npm run build`. The build uses the workspace's own TypeScript,
 * Vite and tsup, so stop early with a clear message when `npm install` hasn't run.
 */

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const tools = ['tsc', 'vite', 'tsup'];
const missing = tools.filter((tool) => !existsSync(new URL(`../node_modules/.bin/${tool}`, import.meta.url)));

if (missing.length > 0) {
  console.error(
    `\nDependencies are not installed (missing: ${missing.join(', ')}).\n` +
      `Run \`npm install\` in ${root} first, then \`npm run build\` again.\n` +
      'No global TypeScript install is needed.\n'
  );
  process.exit(1);
}
