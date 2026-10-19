// Chat with the Claude Code session the connected MCP server is attached to.
// The background service worker owns the history; this mirrors it for the panel.
// State is module-level (like useSettings) so every caller shares it.

import { ref } from 'vue';
import type { ChatBridgeInfo, ChatEntry } from '@inspector-jake/shared';

const messages = ref<ChatEntry[]>([]);
const bridgeInfo = ref<ChatBridgeInfo | null>(null);
const sending = ref(false);
const error = ref<string | null>(null);
const unread = ref(0);
let sessionName: string | null = null;

/** Load history and bridge status for the connected session. */
async function refresh(): Promise<void> {
  try {
    const state = await chrome.runtime.sendMessage({ type: 'GET_CHAT_STATE' });
    sessionName = state?.sessionName ?? null;
    messages.value = Array.isArray(state?.history) ? state.history : [];
    bridgeInfo.value = state?.bridgeInfo ?? null;
  } catch {
    // Background not ready yet; the next connection refreshes
  }
}

/** Send a message. Resolves true once the MCP server has handed it to the session. */
async function send(text: string): Promise<boolean> {
  if (!text.trim() || sending.value) return false;
  sending.value = true;
  error.value = null;
  try {
    const result = await chrome.runtime.sendMessage({ type: 'CHAT_SEND', text });
    if (!result?.ok) {
      error.value = result?.error ?? 'Message not sent.';
      return false;
    }
    return true;
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Message not sent.';
    return false;
  } finally {
    sending.value = false;
  }
}

/**
 * Apply a CHAT_ENTRY broadcast from the background.
 * `viewing` is whether the chat view is open; other arrivals count as unread.
 */
function handleEntry(message: { sessionName?: string; entry: ChatEntry }, viewing: boolean): void {
  if (message.sessionName && sessionName && message.sessionName !== sessionName) return;
  sessionName ??= message.sessionName ?? null;

  const index = messages.value.findIndex((e) => e.id === message.entry.id);
  if (index === -1) {
    messages.value = [...messages.value, message.entry];
    if (message.entry.role !== 'you' && !viewing) unread.value++;
  } else {
    messages.value = messages.value.map((e, i) => (i === index ? message.entry : e));
  }
}

/** Apply a CHAT_BRIDGE_INFO broadcast from the background. */
function handleBridgeInfo(message: { bridgeInfo: ChatBridgeInfo | null }): void {
  bridgeInfo.value = message.bridgeInfo;
}

function markRead(): void {
  unread.value = 0;
}

function reset(): void {
  messages.value = [];
  bridgeInfo.value = null;
  error.value = null;
  unread.value = 0;
  sessionName = null;
}

export function useChat() {
  return {
    messages,
    bridgeInfo,
    sending,
    error,
    unread,
    refresh,
    send,
    handleEntry,
    handleBridgeInfo,
    markRead,
    reset,
  };
}
