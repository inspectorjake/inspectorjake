/**
 * Console capture — patches console methods to collect logs.
 * Import this module for its side effects (executes immediately).
 */

import { MAX_CONSOLE_LOGS } from './constants.js';

const logs: Array<{ type: string; message: string; timestamp: number }> = [];
(window as any).__consoleLogs = logs;

function pushLog(type: string, message: string) {
  logs.push({ type, message, timestamp: Date.now() });
  if (logs.length > MAX_CONSOLE_LOGS) logs.shift();
}

function formatArgs(args: any[]): string {
  return args.map(a => {
    try { return typeof a === 'string' ? a : JSON.stringify(a); }
    catch { return String(a); }
  }).join(' ');
}

// Patch console methods
const methodsToCapture = ['log', 'warn', 'error', 'info', 'debug', 'trace'] as const;
for (const method of methodsToCapture) {
  const original = console[method].bind(console);
  console[method] = (...args: any[]) => {
    pushLog(method, formatArgs(args));
    original(...args);
  };
}

// Patch console.assert
const originalAssert = console.assert.bind(console);
console.assert = (condition?: boolean, ...args: any[]) => {
  if (!condition) {
    pushLog('assert', 'Assertion failed: ' + formatArgs(args));
  }
  originalAssert(condition, ...args);
};

// Uncaught exceptions
window.addEventListener('error', (e) => {
  pushLog('exception', `${e.message} at ${e.filename}:${e.lineno}:${e.colno}`);
});

// Unhandled promise rejections
window.addEventListener('unhandledrejection', (e) => {
  const reason = e.reason instanceof Error ? e.reason.message : String(e.reason);
  pushLog('unhandledrejection', reason);
});
