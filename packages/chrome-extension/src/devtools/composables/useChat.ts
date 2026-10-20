// Chat with the Claude Code session the connected MCP server is attached to.
// The background service worker owns the history; this mirrors it for the panel.
// State is module-level (like useSettings) so every caller shares it.

import { ref } from 'vue';
import type { ChatBridgeInfo, ChatEntry, ChatThumbnail, Selection } from '@inspector-jake/shared';

/** What "Send to Claude" says for you */
export const SEND_TO_CLAUDE_TEXT = 'Make the changes in my notes.';

/** Long side of a chat thumbnail in px. They show at 44px, so this stays sharp on 2x screens. */
const THUMBNAIL_SIZE = 96;

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

/** Shrink a capture's screenshot to a small WebP data URL, or '' if it can't be decoded. */
async function shrinkImage(src: string): Promise<string> {
  try {
    const img = new Image();
    img.src = src;
    await img.decode();
    const scale = Math.min(1, THUMBNAIL_SIZE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/webp', 0.85);
  } catch {
    return '';
  }
}

/** Previews of the captures, kept with the message so the chat shows what was sent. */
export async function makeChatThumbnails(selections: Selection[]): Promise<ChatThumbnail[]> {
  return Promise.all(
    selections.map(async (sel) => ({
      id: sel.id,
      src: sel.image ? await shrinkImage(sel.image) : '',
      label: sel.type === 'element' ? `<${sel.tagName.toLowerCase()}>` : 'Region',
      ...(sel.note?.trim() ? { note: sel.note.trim() } : {}),
    }))
  );
}

/**
 * Send a message with thumbnails of the captures it carries.
 * Resolves true once the MCP server has handed it to the session.
 */
async function send(text: string, selections: Selection[] = []): Promise<boolean> {
  if (!text.trim() || sending.value) return false;
  sending.value = true;
  error.value = null;
  try {
    const thumbnails = await makeChatThumbnails(selections);
    const result = await chrome.runtime.sendMessage({
      type: 'CHAT_SEND',
      text,
      ...(thumbnails.length > 0 ? { thumbnails } : {}),
    });
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
