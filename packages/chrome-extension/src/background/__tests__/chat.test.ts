import { beforeEach, describe, expect, it, vi } from 'vitest';

const handleToolRequest = vi.fn(async () => ({ id: 'x', success: true }));

vi.mock('../tool-handlers.js', () => ({
  handleToolRequest,
  buildSelectionsResponse: () => [
    {
      type: 'element',
      id: 'el-1',
      selector: 'button.cta',
      tagName: 'button',
      dimensions: '120x40',
      rect: { x: 0, y: 0, width: 120, height: 40 },
      note: 'Make this bigger',
      image: 'data:image/png;base64,AAAA',
    },
  ],
}));

class FakeWebSocket {
  static OPEN = 1;
  static instances: FakeWebSocket[] = [];
  readyState = 0;
  sent: any[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => unknown) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;

  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(JSON.parse(data));
  }

  close() {
    this.readyState = 3;
    this.onclose?.();
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }

  receive(message: object) {
    return this.onmessage?.({ data: JSON.stringify(message) });
  }
}

const sendMessage = vi.fn(async () => undefined);
const sessionStore = new Map<string, unknown>();

let wsClient: typeof import('../ws-client.js');
let chat: typeof import('../chat.js');

const flush = () => new Promise((r) => setTimeout(r, 0));

/** CHAT_ENTRY broadcasts sent to the panel, in order */
const chatEntries = () =>
  sendMessage.mock.calls
    .map(([m]: any[]) => m)
    .filter((m: any) => m?.type === 'CHAT_ENTRY');

async function connect(): Promise<FakeWebSocket> {
  const connecting = wsClient.connectToSession('jake', 52192, 7);
  const ws = FakeWebSocket.instances.at(-1)!;
  ws.open();
  await connecting;
  return ws;
}

describe('background chat', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    FakeWebSocket.instances = [];
    sessionStore.clear();

    vi.stubGlobal('WebSocket', FakeWebSocket);
    vi.stubGlobal('chrome', {
      runtime: { sendMessage },
      alarms: { create: vi.fn(), clear: vi.fn() },
      tabs: {
        get: vi.fn((_id: number, callback?: (tab: object) => void) => {
          const tab = { title: 'Pricing', url: 'https://example.com/pricing' };
          if (callback) {
            callback(tab);
            return undefined;
          }
          return Promise.resolve(tab);
        }),
      },
      storage: {
        session: {
          get: vi.fn(async (key: string) => (sessionStore.has(key) ? { [key]: sessionStore.get(key) } : {})),
          set: vi.fn(async (items: Record<string, unknown>) => {
            for (const [k, v] of Object.entries(items)) sessionStore.set(k, v);
          }),
        },
      },
    });

    wsClient = await import('../ws-client.js');
    chat = await import('../chat.js');
    wsClient.setChatListeners(
      (message, sessionName) => void chat.handleChatServerMessage(message, sessionName),
      chat.handleChatDisconnected
    );
  });

  it('refuses to send while not connected', async () => {
    expect(await chat.sendChatMessage('hi')).toEqual({ ok: false, error: 'Connect to an MCP session first.' });
  });

  it('keeps chat pushes away from the tool handler', async () => {
    const ws = await connect();
    await ws.receive({ type: 'chat_message', id: 'r1', from: 'uds:/x', fromName: 'main', text: 'Hello from Claude', ts: 5 });
    await flush();

    expect(handleToolRequest).not.toHaveBeenCalled();
    expect(chatEntries()).toEqual([
      {
        type: 'CHAT_ENTRY',
        sessionName: 'jake',
        entry: { id: 'r1', role: 'claude', text: 'Hello from Claude', ts: 5, fromName: 'main' },
      },
    ]);
    expect(sessionStore.get('chatHistory:jake')).toHaveLength(1);
  });

  it('sends the page and captures without image data, then marks the message sent', async () => {
    const ws = await connect();
    const result = chat.sendChatMessage('  what did I select?  ');
    await flush();

    const frame = ws.sent.find((m) => m.type === 'chat_send');
    expect(frame).toMatchObject({
      text: 'what did I select?',
      page: { url: 'https://example.com/pricing', title: 'Pricing' },
      selections: [{ id: 'el-1', note: 'Make this bigger', selector: 'button.cta' }],
    });
    expect(frame.selections[0]).not.toHaveProperty('image');

    await ws.receive({ type: 'chat_ack', id: frame.id, ok: true });
    expect(await result).toEqual({ ok: true });

    const statuses = chatEntries().map((m: any) => m.entry.status);
    expect(statuses).toEqual(['sending', 'sent']);
    expect(chatEntries()[0].entry).toMatchObject({ role: 'you', attachments: 1 });
  });

  it('marks the message failed when the server rejects it', async () => {
    const ws = await connect();
    const result = chat.sendChatMessage('hi');
    await flush();
    const frame = ws.sent.find((m) => m.type === 'chat_send');

    await ws.receive({ type: 'chat_ack', id: frame.id, ok: false, error: 'session is gone' });
    expect(await result).toEqual({ ok: false, error: 'session is gone' });
    expect(chatEntries().at(-1).entry).toMatchObject({ status: 'failed', error: 'session is gone' });
  });

  it('fails pending sends when the connection drops', async () => {
    const ws = await connect();
    const result = chat.sendChatMessage('hi');
    await flush();
    ws.close();
    expect(await result).toEqual({ ok: false, error: 'Disconnected from the MCP server.' });
  });

  it('turns delivery status into a system entry', async () => {
    const ws = await connect();
    await ws.receive({ type: 'chat_status', status: 'held', ts: 9 });
    await flush();
    expect(chatEntries()[0].entry).toMatchObject({
      role: 'system',
      text: 'Held for approval in the Claude Code terminal.',
    });
  });

  it('reports bridge info and history to the panel', async () => {
    const ws = await connect();
    await ws.receive({ type: 'chat_bridge_info', available: true, name: 'jake-panel', parentName: 'main' });
    await ws.receive({ type: 'chat_message', id: 'r1', from: 'uds:/x', text: 'hi', ts: 1 });
    await flush();

    expect(sendMessage).toHaveBeenCalledWith({
      type: 'CHAT_BRIDGE_INFO',
      sessionName: 'jake',
      bridgeInfo: { available: true, name: 'jake-panel', parentName: 'main' },
    });
    const state = await chat.getChatState();
    expect(state.sessionName).toBe('jake');
    expect(state.bridgeInfo).toEqual({ available: true, name: 'jake-panel', parentName: 'main' });
    expect(state.history.map((e) => e.id)).toEqual(['r1']);
  });
});
