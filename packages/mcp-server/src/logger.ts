/**
 * Jake MCP MCP Server Logger
 *
 * CRITICAL: All output goes to stderr (console.error).
 * MCP protocol uses stdout for JSON-RPC communication.
 * Diagnostic logs MUST use stderr only.
 *
 * Configure via environment variable: INSPECTOR_JAKE_LOG_LEVEL=debug
 * Valid levels: trace, debug, info, warn, error, silent
 *
 * Logs are also written to: /tmp/inspector-jake-mcp.log
 * Tail with: tail -f /tmp/inspector-jake-mcp.log
 */

import { appendFileSync } from 'fs';
import { LOG_LEVELS, type LogLevel } from '@inspector-jake/shared';

const PREFIX = "[Jake MCP]";
const LOG_FILE = '/tmp/inspector-jake-mcp.log';

function getLogLevel(): LogLevel {
  const envLevel = process.env.INSPECTOR_JAKE_LOG_LEVEL?.toLowerCase();
  if (envLevel && envLevel in LOG_LEVELS) {
    return envLevel as LogLevel;
  }
  return 'trace'; // Default - set to trace for debugging
}

let currentLevel: LogLevel = getLogLevel();

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

function formatArgs(args: unknown[]): string {
  return args
    .map((arg) => {
      if (arg instanceof Error) {
        return `${arg.message}\n${arg.stack}`;
      }
      if (typeof arg === 'object' && arg !== null) {
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    })
    .join(' ');
}

function writeToFile(message: string): void {
  try {
    appendFileSync(LOG_FILE, message + '\n');
  } catch {
    // Silently ignore file write errors
  }
}

// ALL methods use console.error (stderr) - MCP protocol requirement
// Also writes to LOG_FILE for easy tailing
export const log = {
  trace: (component: string, ...args: unknown[]): void => {
    if (shouldLog('trace')) {
      const msg = `${formatTimestamp()} ${PREFIX} [TRACE] [${component}] ${formatArgs(args)}`;
      console.error(msg);
      writeToFile(msg);
    }
  },

  debug: (component: string, ...args: unknown[]): void => {
    if (shouldLog('debug')) {
      const msg = `${formatTimestamp()} ${PREFIX} [DEBUG] [${component}] ${formatArgs(args)}`;
      console.error(msg);
      writeToFile(msg);
    }
  },

  info: (component: string, ...args: unknown[]): void => {
    if (shouldLog('info')) {
      const msg = `${formatTimestamp()} ${PREFIX} [INFO] [${component}] ${formatArgs(args)}`;
      console.error(msg);
      writeToFile(msg);
    }
  },

  warn: (component: string, ...args: unknown[]): void => {
    if (shouldLog('warn')) {
      const msg = `${formatTimestamp()} ${PREFIX} [WARN] [${component}] ${formatArgs(args)}`;
      console.error(msg);
      writeToFile(msg);
    }
  },

  error: (component: string, ...args: unknown[]): void => {
    if (shouldLog('error')) {
      const msg = `${formatTimestamp()} ${PREFIX} [ERROR] [${component}] ${formatArgs(args)}`;
      console.error(msg);
      writeToFile(msg);
    }
  },

  setLevel: (level: LogLevel): void => {
    currentLevel = level;
  },

  getLevel: (): LogLevel => currentLevel,
};
