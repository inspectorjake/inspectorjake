/**
 * Chat with the Claude Code session the connected MCP server is attached to.
 *
 * The background owns the history (in chrome.storage.session, per MCP session name)
 * so replies that arrive while DevTools is closed are still there when it reopens.
 * Every change is broadcast to the panel as CHAT_ENTRY.
 */

import type {
  ChatBridgeInfo,
  ChatEntry,
  ChatPageContext,
  ChatServerMessage,
  ChatThumbnail,
  SessionName,
} from '@inspector-jake/shared';
import { buildSelectionsResponse } from './tool-handlers.js';
import { getConnectionStatus, sendChat } from './ws-client.js';
import { log } from '../utils/logger.js';

const MAX_HISTORY = 200;
// Thumbnails are stored with the history, so keep them few and small (a 96px WebP is a few KB)
const MAX_THUMBNAILS = 12;
const MAX_THUMBNAIL_URL_LENGTH = 60_000;

let bridgeInfo: ChatBridgeInfo | null = null;
let history: ChatEntry[] = [];
let historyKey: string | null = null;

function storageKey(sessionName: string): string {
  return `chatHistory:${sessionName}`;
}

async function loadHistory(sessionName: string): Promise<ChatEntry[]> {
  const key = storageKey(sessionName);
  if (historyKey === key) return history;
  try {
    const stored = await chrome.storage.session.get(key);
    history = Array.isArray(stored[key]) ? stored[key] : [];
  } catch {
    history = [];
  }
  historyKey = key;
  return history;
}

/** Insert or replace an entry by id, persist, and tell the panel. */
async function upsertEntry(sessionName: string, entry: ChatEntry): Promise<void> {
  const list = await loadHistory(sessionName);
  const index = list.findIndex((e) => e.id === entry.id);
  if (index === -1) {
    list.push(entry);
    if (list.length > MAX_HISTORY) list.splice(0, list.length - MAX_HISTORY);
  } else {
    list[index] = entry;
  }
  chrome.storage.session.set({ [storageKey(sessionName)]: list }).catch(() => {});
  chrome.runtime.sendMessage({ type: 'CHAT_ENTRY', sessionName, entry }).catch(() => {
    // Panel might be closed
  });
}

function describeStatus(status: string, reason?: string): string {
  if (reason) return reason;
  switch (status) {
    case 'held':
      return 'Held for approval in the Claude Code terminal.';
    case 'expired':
      return 'Expired before Claude read it.';
    case 'refused':
      return 'The Claude Code session refused the message.';
    case 'dropped':
      return 'The Claude Code session dropped the message (rate limit, duplicate or full queue).';
    default:
      return `Delivery status: ${status}`;
  }
}

async function getPageContext(tabId: number | null): Promise<ChatPageContext | undefined> {
  if (!tabId) return undefined;
  try {
    const tab = await chrome.tabs.get(tabId);
    return { url: tab.url || 'unknown', title: tab.title || 'Untitled' };
  } catch {
    return undefined;
  }
}

/**
 * History and bridge status for the connected session, for the panel to render on open.
 */
export async function getChatState(): Promise<{
  sessionName: SessionName | null;
  bridgeInfo: ChatBridgeInfo | null;
  history: ChatEntry[];
}> {
  const { connected, sessionName } = getConnectionStatus();
  if (!connected || !sessionName) {
    return { sessionName: null, bridgeInfo: null, history: [] };
  }
  return { sessionName, bridgeInfo, history: [...(await loadHistory(sessionName))] };
}

/** Keep only well-formed thumbnails, with an image only if it is a small data URL. */
function cleanThumbnails(value: unknown): ChatThumbnail[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((t): t is ChatThumbnail =>
      !!t && typeof t.id === 'string' && typeof t.label === 'string' && typeof t.src === 'string')
    .slice(0, MAX_THUMBNAILS)
    .map((t) => ({
      id: t.id,
      label: t.label.slice(0, 40),
      src: t.src.startsWith('data:image/') && t.src.length <= MAX_THUMBNAIL_URL_LENGTH ? t.src : '',
      ...(typeof t.note === 'string' && t.note ? { note: t.note.slice(0, 500) } : {}),
    }));
}

/**
 * Send what the user typed, plus the page and every capture with its note.
 * `thumbnails` are the panel's previews of those captures, shown with the message in the chat.
 */
export async function sendChatMessage(
  text: string,
  thumbnails?: unknown
): Promise<{ ok: boolean; error?: string }> {
  const { connected, sessionName, tabId } = getConnectionStatus();
  if (!connected || !sessionName) {
    return { ok: false, error: 'Connect to an MCP session first.' };
  }
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, error: 'Type a message first.' };
  }

  // Same shape see_jakes_notes returns, minus image data; Claude can fetch images by id
  const selections = buildSelectionsResponse().map(({ image: _image, ...rest }) => rest);
  const previews = cleanThumbnails(thumbnails);
  const entry: ChatEntry = {
    id: crypto.randomUUID(),
    role: 'you',
    text: trimmed,
    ts: Date.now(),
    attachments: selections.length,
    ...(previews.length > 0 ? { thumbnails: previews } : {}),
    status: 'sending',
  };
  await upsertEntry(sessionName, entry);

  const ack = await sendChat({
    type: 'chat_send',
    id: entry.id,
    text: trimmed,
    page: await getPageContext(tabId),
    selections,
  });

  await upsertEntry(sessionName, {
    ...entry,
    status: ack.ok ? 'sent' : 'failed',
    ...(ack.error && { error: ack.error }),
  });
  if (!ack.ok) log.warn('Chat', 'Send failed:', ack.error);
  return ack.ok ? { ok: true } : { ok: false, error: ack.error };
}

/**
 * Handle a chat push from the MCP server (everything except acks, which ws-client resolves).
 */
export async function handleChatServerMessage(
  message: Exclude<ChatServerMessage, { type: 'chat_ack' }>,
  sessionName: SessionName
): Promise<void> {
  switch (message.type) {
    case 'chat_bridge_info': {
      const { type: _type, ...info } = message;
      bridgeInfo = info;
      chrome.runtime.sendMessage({ type: 'CHAT_BRIDGE_INFO', sessionName, bridgeInfo }).catch(() => {});
      break;
    }

    case 'chat_message':
      await upsertEntry(sessionName, {
        id: message.id,
        role: 'claude',
        text: message.text,
        ts: message.ts,
        ...(message.fromName && { fromName: message.fromName }),
      });
      break;

    case 'chat_status':
      await upsertEntry(sessionName, {
        id: crypto.randomUUID(),
        role: 'system',
        text: describeStatus(message.status, message.reason),
        ts: message.ts,
      });
      break;
  }
}

/** Forget the bridge status when the MCP connection closes. History stays. */
export function handleChatDisconnected(): void {
  bridgeInfo = null;
}
