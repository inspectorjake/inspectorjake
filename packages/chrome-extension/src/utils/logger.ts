/**
 * Jake MCP Chrome Extension Logger
 *
 * Configure via:
 *   - DevTools console: __jakesVibeLog.setLevel('debug')
 *   - Chrome storage: chrome.storage.local.set({ logLevel: 'debug' })
 *
 * Valid levels: trace, debug, info, warn, error, silent
 */

import { LOG_LEVELS, type LogLevel } from '@inspector-jake/shared';

const PREFIX = "[Jake MCP]";
const STORAGE_KEY = 'logLevel';

let currentLevel: LogLevel = 'trace'; // Set to trace for debugging

// Load level from storage on init
if (typeof chrome !== 'undefined' && chrome.storage?.local) {
  chrome.storage.local.get(STORAGE_KEY).then((result) => {
    if (result[STORAGE_KEY] && result[STORAGE_KEY] in LOG_LEVELS) {
      currentLevel = result[STORAGE_KEY] as LogLevel;
    }
  }).catch(() => {
    // Storage might not be available in all contexts
  });
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatTimestamp(): string {
  return new Date().toISOString().split('T')[1].slice(0, -1); // HH:MM:SS.mmm
}

function formatArgs(args: unknown[]): unknown[] {
  return args.map((arg) => {
    if (arg instanceof Error) {
      return `${arg.message}\n${arg.stack}`;
    }
    if (typeof arg === 'object' && arg !== null) {
      try {
        return JSON.stringify(arg, null, 2);
      } catch {
        return arg;
      }
    }
    return arg;
  });
}

export const log = {
  trace: (component: string, ...args: unknown[]): void => {
    if (shouldLog('trace')) {
      console.debug(`${formatTimestamp()} ${PREFIX} [TRACE] [${component}]`, ...formatArgs(args));
    }
  },

  debug: (component: string, ...args: unknown[]): void => {
    if (shouldLog('debug')) {
      console.debug(`${formatTimestamp()} ${PREFIX} [DEBUG] [${component}]`, ...formatArgs(args));
    }
  },

  info: (component: string, ...args: unknown[]): void => {
    if (shouldLog('info')) {
      console.info(`${formatTimestamp()} ${PREFIX} [INFO] [${component}]`, ...formatArgs(args));
    }
  },

  warn: (component: string, ...args: unknown[]): void => {
    if (shouldLog('warn')) {
      console.warn(`${formatTimestamp()} ${PREFIX} [WARN] [${component}]`, ...formatArgs(args));
    }
  },

  error: (component: string, ...args: unknown[]): void => {
    if (shouldLog('error')) {
      console.error(`${formatTimestamp()} ${PREFIX} [ERROR] [${component}]`, ...formatArgs(args));
    }
  },

  setLevel: async (level: LogLevel): Promise<void> => {
    currentLevel = level;
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.set({ [STORAGE_KEY]: level });
    }
  },

  getLevel: (): LogLevel => currentLevel,
};

// Expose for debugging in DevTools console
if (typeof globalThis !== 'undefined') {
  (globalThis as any).__jakesVibeLog = log;
}
