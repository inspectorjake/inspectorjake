/**
 * Composable for logs panel state and operations.
 * Captures extension events and provides retro-terminal display.
 */
import { ref, readonly, type Ref } from 'vue';

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  SUCCESS = 'success',
}

export enum LogSource {
  EXT = 'ext',
  PAGE = 'page',
  MCP = 'mcp',
}

export interface LogEntry {
  id: number;
  time: string;
  level: LogLevel;
  source: LogSource;
  message: string;
}

/** Message types this composable handles */
interface LogMessage {
  type: 'EXTENSION_LOG' | 'PAGE_CONSOLE';
  level?: LogLevel;
  text: string;
}

/** Return type for useLogs composable */
export interface UseLogsReturn {
  logs: Readonly<Ref<LogEntry[]>>;
  showLogs: Ref<boolean>;
  hasErrors: Readonly<Ref<boolean>>;
  addLog: (level: LogLevel, source: LogSource, message: string) => void;
  clearLogs: () => void;
  toggleLogs: () => void;
}

/** Configuration */
const MAX_LOGS = 500;
const MAX_MESSAGE_LENGTH = 1000;

/** Global counter - shared across instances for unique IDs */
let globalLogId = 0;

/**
 * Format current time as HH:MM:SS.
 */
function formatTime(): string {
  return new Date().toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Composable for log panel state and operations.
 */
export function useLogs(): UseLogsReturn {
  const logs = ref<LogEntry[]>([]);
  const showLogs = ref(true);

  function addLog(level: LogLevel, source: LogSource, message: string): void {
    const entry: LogEntry = {
      id: ++globalLogId,
      time: formatTime(),
      level,
      source,
      message: String(message).slice(0, MAX_MESSAGE_LENGTH),
    };
    logs.value.push(entry);

    // Trim old logs to prevent memory bloat
    if (logs.value.length > MAX_LOGS) {
      logs.value = logs.value.slice(-MAX_LOGS);
    }
  }

  function clearLogs(): void {
    logs.value = [];
    addLog(LogLevel.INFO, LogSource.EXT, 'Logs cleared');
  }

  function toggleLogs(): void {
    showLogs.value = !showLogs.value;
  }

  // Computed: has any error logs
  const hasErrors = ref(false);

  // Note: Message listener should be set up in the component that uses this composable
  // to avoid lifecycle issues with multiple composable instances

  return {
    logs: readonly(logs),
    showLogs,
    hasErrors: readonly(hasErrors),
    addLog,
    clearLogs,
    toggleLogs,
  };
}
