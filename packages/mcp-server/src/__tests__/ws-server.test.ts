/**
 * Tests for the WebSocket server: origin checks, single-client handling and chat messages.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { WebSocket } from 'ws';
import { createWsServer, isAllowedOrigin, type WsServerHooks, type WsServerInstance } from '../ws-server.js';

const EXTENSION_ORIGIN = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';

describe('isAllowedOrigin', () => {
  it('accepts Chrome extension origins', () => {
    expect(isAllowedOrigin(EXTENSION_ORIGIN, [])).toBe(true);
  });

  it('rejects web pages, missing origins and malformed IDs', () => {
    expect(isAllowedOrigin('https://evil.example', [])).toBe(false);
    expect(isAllowedOrigin('http://127.0.0.1:52192', [])).toBe(false);
    expect(isAllowedOrigin(undefined, [])).toBe(false);
    expect(isAllowedOrigin('chrome-extension://short', [])).toBe(false);
  });

  it('honours a pinned extension ID list', () => {
    expect(isAllowedOrigin(EXTENSION_ORIGIN, ['abcdefghijklmnopabcdefghijklmnop'])).toBe(true);
    expect(isAllowedOrigin(EXTENSION_ORIGIN, ['ponmlkjihgfedcbaponmlkjihgfedcba'])).toBe(false);
  });
});

describe('createWsServer', () => {
  let server: WsServerInstance | null = null;
  const clients: WebSocket[] = [];

  afterEach(() => {
    for (const c of clients.splice(0)) c.terminate();
    server?.close();
    server = null;
  });

  async function start(hooks: WsServerHooks = {}) {
    // Random high port; collisions are retried
    for (let attempt = 0; attempt < 5; attempt++) {
      const port = 40000 + Math.floor(Math.random() * 10000);
      try {
        server = await createWsServer(port, hooks);
        return server;
      } catch {
        // port in use
      }
    }
    throw new Error('no free port');
  }

  /** Connect and collect every message the server sends. */
  function connect(origin: string | null = EXTENSION_ORIGIN) {
    const ws = new WebSocket(`ws://127.0.0.1:${server!.port}`, origin ? { origin } : {});
    clients.push(ws);
    const messages: any[] = [];
    ws.on('message', (data) => messages.push(JSON.parse(data.toString())));
    const opened = new Promise<void>((resolve, reject) => {
      ws.once('open', () => resolve());
      ws.once('error', reject);
    });
    return { ws, messages, opened };
  }

  const waitFor = async (check: () => boolean) => {
    for (let i = 0; i < 100 && !check(); i++) {
      await new Promise((r) => setTimeout(r, 10));
    }
    expect(check()).toBe(true);
  };

  it('rejects connections that do not come from a Chrome extension', async () => {
    await start();
    await expect(connect('https://evil.example').opened).rejects.toThrow(/401/);
    await expect(connect(null).opened).rejects.toThrow(/401/);
    expect(server!.isConnected()).toBe(false);
  });

  it('sends chat bridge info when an extension connects', async () => {
    await start({ getChatBridgeInfo: () => ({ available: true, name: 'jake-panel', parentName: 'main' }) });
    const client = connect();
    await client.opened;
    await waitFor(() => client.messages.length === 1);
    expect(client.messages[0]).toEqual({
      type: 'chat_bridge_info',
      available: true,
      name: 'jake-panel',
      parentName: 'main',
    });
  });

  it('relays chat_send to the hook and acknowledges it', async () => {
    const onChatSend = vi.fn().mockResolvedValue(undefined);
    await start({ onChatSend });
    const client = connect();
    await client.opened;

    const message = { type: 'chat_send', id: 'm1', text: 'hi', selections: [] };
    client.ws.send(JSON.stringify(message));

    await waitFor(() => client.messages.some((m) => m.type === 'chat_ack'));
    expect(onChatSend).toHaveBeenCalledWith(message);
    expect(client.messages.find((m) => m.type === 'chat_ack')).toEqual({ type: 'chat_ack', id: 'm1', ok: true });
  });

  it('reports a failed chat_send back to the extension', async () => {
    await start({ onChatSend: () => Promise.reject(new Error('session is gone')) });
    const client = connect();
    await client.opened;

    client.ws.send(JSON.stringify({ type: 'chat_send', id: 'm2', text: 'hi', selections: [] }));

    await waitFor(() => client.messages.some((m) => m.type === 'chat_ack'));
    expect(client.messages.find((m) => m.type === 'chat_ack')).toEqual({
      type: 'chat_ack',
      id: 'm2',
      ok: false,
      error: 'session is gone',
    });
  });

  it('buffers chat messages while no extension is connected and flushes them on connect', async () => {
    await start();
    server!.pushToClient({ type: 'chat_message', id: 'r1', from: 'uds:/x', text: 'early reply', ts: 1 });
    server!.pushToClient({ type: 'chat_status', status: 'held', ts: 2 });

    const client = connect();
    await client.opened;
    await waitFor(() => client.messages.length === 2);
    expect(client.messages.map((m) => m.type)).toEqual(['chat_message', 'chat_status']);
    expect(client.messages[0].text).toBe('early reply');
  });

  it('replaces an older connection with a newer one', async () => {
    await start();
    const first = connect();
    await first.opened;
    const firstClosed = new Promise<number>((resolve) => first.ws.once('close', (code) => resolve(code)));

    const second = connect();
    await second.opened;
    expect(await firstClosed).toBe(4000);

    // The old socket closing must not clear the new client
    await new Promise((r) => setTimeout(r, 20));
    expect(server!.isConnected()).toBe(true);
    server!.pushToClient({ type: 'chat_message', id: 'r2', from: 'uds:/x', text: 'to the new client', ts: 3 });
    await waitFor(() => second.messages.some((m) => m.text === 'to the new client'));
  });
});
