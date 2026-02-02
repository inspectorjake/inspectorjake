/**
 * Composable for logs panel state and operations.
 * Captures extension events and provides retro-terminal display.
 */
import { ref, onMounted, onUnmounted } from 'vue';

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

let logIdCounter = 0;

export function useLogs() {
  const logs = ref<LogEntry[]>([]);
  const showLogs = ref(false);
  const MAX_LOGS = 500;

  function formatTime(): string {
    return new Date().toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  function addLog(level: LogLevel, source: LogSource, message: string) {
    const entry: LogEntry = {
      id: ++logIdCounter,
      time: formatTime(),
      level,
      source,
      message: String(message).slice(0, 1000),
    };
    logs.value.push(entry);

    // Trim old logs
    if (logs.value.length > MAX_LOGS) {
      logs.value = logs.value.slice(-MAX_LOGS);
    }
  }

  function clearLogs() {
    logs.value = [];
    addLog(LogLevel.INFO, LogSource.EXT, 'Logs cleared');
  }

  function toggleLogs() {
    showLogs.value = !showLogs.value;
  }

  // Listen for messages from background
  function handleMessage(message: any) {
    if (message.type === 'EXTENSION_LOG') {
      addLog(message.level || LogLevel.INFO, LogSource.EXT, message.text);
    }
    if (message.type === 'PAGE_CONSOLE') {
      addLog(message.level || LogLevel.INFO, LogSource.PAGE, message.text);
    }
  }

  onMounted(() => {
    if (chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener(handleMessage);
    }
  });

  onUnmounted(() => {
    if (chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.removeListener(handleMessage);
    }
  });

  return {
    logs,
    showLogs,
    addLog,
    clearLogs,
    toggleLogs,
    LogLevel,
    LogSource,
  };
}
