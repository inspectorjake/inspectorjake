/**
 * Shared log level definitions for Jake MCP MCP server and Chrome extension.
 */

export const LOG_LEVELS = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  silent: 5,
} as const;

export type LogLevel = keyof typeof LOG_LEVELS;
