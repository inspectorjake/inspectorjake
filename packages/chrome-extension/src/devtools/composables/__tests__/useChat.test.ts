import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatEntry } from '@inspector-jake/shared';

const mockSendMessage = vi.fn();
vi.stubGlobal('chrome', { runtime: { sendMessage: mockSendMessage } });

let useChat: typeof import('../useChat.js').useChat;

const entry = (overrides: Partial<ChatEntry> = {}): ChatEntry => ({
  id: 'e1',
  role: 'claude',
  text: 'hello',
  ts: 1,
  ...overrides,
});

describe('useChat', () => {
  beforeEach(async () => {
    mockSendMessage.mockReset();
    // State is module-level; start each test fresh
    vi.resetModules();
    ({ useChat } = await import('../useChat.js'));
  });

  it('loads history and bridge info from the background', async () => {
    mockSendMessage.mockResolvedValue({
      sessionName: 'jake',
      bridgeInfo: { available: true, name: 'jake-panel' },
      history: [entry()],
    });
    const chat = useChat();
    await chat.refresh();

    expect(mockSendMessage).toHaveBeenCalledWith({ type: 'GET_CHAT_STATE' });
    expect(chat.messages.value).toEqual([entry()]);
    expect(chat.bridgeInfo.value).toEqual({ available: true, name: 'jake-panel' });
  });

  it('sends text and reports success', async () => {
    mockSendMessage.mockResolvedValue({ ok: true });
    const chat = useChat();

    expect(await chat.send('hi')).toBe(true);
    expect(mockSendMessage).toHaveBeenCalledWith({ type: 'CHAT_SEND', text: 'hi' });
    expect(chat.error.value).toBeNull();
    expect(chat.sending.value).toBe(false);
  });

  it('sends thumbnails of the captures with the message', async () => {
    mockSendMessage.mockResolvedValue({ ok: true });
    const chat = useChat();
    const selections = [
      { id: 's1', type: 'element', tagName: 'BUTTON', image: '', note: ' Make it orange ', timestamp: 0, width: 1, height: 1 },
      { id: 's2', type: 'screenshot', image: '', timestamp: 0, width: 1, height: 1 },
    ] as any;

    expect(await chat.send('Make the changes in my notes.', selections)).toBe(true);
    expect(mockSendMessage).toHaveBeenCalledWith({
      type: 'CHAT_SEND',
      text: 'Make the changes in my notes.',
      thumbnails: [
        { id: 's1', src: '', label: '<button>', note: 'Make it orange' },
        { id: 's2', src: '', label: 'Region' },
      ],
    });
  });

  it('keeps the error when sending fails', async () => {
    mockSendMessage.mockResolvedValue({ ok: false, error: 'session is gone' });
    const chat = useChat();

    expect(await chat.send('hi')).toBe(false);
    expect(chat.error.value).toBe('session is gone');
  });

  it('ignores blank messages', async () => {
    const chat = useChat();
    expect(await chat.send('   ')).toBe(false);
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('upserts entries and counts unread replies only when the chat is closed', () => {
    const chat = useChat();

    chat.handleEntry({ sessionName: 'jake', entry: entry({ id: 'a' }) }, false);
    chat.handleEntry({ sessionName: 'jake', entry: entry({ id: 'b' }) }, true);
    chat.handleEntry({ sessionName: 'jake', entry: entry({ id: 'c', role: 'you' }) }, false);
    expect(chat.unread.value).toBe(1);

    chat.handleEntry({ sessionName: 'jake', entry: entry({ id: 'c', role: 'you', status: 'sent' }) }, false);
    expect(chat.messages.value.map((e) => e.id)).toEqual(['a', 'b', 'c']);
    expect(chat.messages.value[2].status).toBe('sent');

    chat.markRead();
    expect(chat.unread.value).toBe(0);
  });

  it('ignores entries for a different MCP session', async () => {
    mockSendMessage.mockResolvedValue({ sessionName: 'jake', bridgeInfo: null, history: [] });
    const chat = useChat();
    await chat.refresh();

    chat.handleEntry({ sessionName: 'annie', entry: entry() }, false);
    expect(chat.messages.value).toEqual([]);
  });

  it('resets everything', () => {
    const chat = useChat();
    chat.handleEntry({ entry: entry() }, false);
    chat.handleBridgeInfo({ bridgeInfo: { available: true } });
    chat.reset();

    expect(chat.messages.value).toEqual([]);
    expect(chat.bridgeInfo.value).toBeNull();
    expect(chat.unread.value).toBe(0);
  });
});
