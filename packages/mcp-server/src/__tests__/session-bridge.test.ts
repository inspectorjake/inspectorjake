/**
 * Tests for the session bridge: wire format helpers and a round trip
 * against a fake parent session socket.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import net from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  authLine,
  bridgeAddressFor,
  bridgeNameFor,
  createSessionBridge,
  isPipePath,
  keyFileName,
  encodeFrame,
  parseFrameLine,
  parseStatStartTime,
  parseWrapper,
  readPidDomain,
  socketAddress,
  wrapContent,
  type DeliveryStatus,
  type InboundChat,
  type SessionBridge,
} from '../session-bridge.js';
import type { ChatBridgeInfo } from '@inspector-jake/shared';

describe('wire format', () => {
  it('builds Claude Code socket addresses', () => {
    expect(socketAddress('/tmp/cc-socks/123.sock')).toBe('uds:/tmp/cc-socks/123.sock');
    expect(socketAddress('/tmp/a b/1.sock')).toBe('uds:/tmp/a%20b/1.sock');
  });

  it('wraps and parses message content', () => {
    const content = wrapContent('uds:/tmp/cc-socks/1.sock', 'jake-panel', 'hello\nworld');
    expect(content).toBe(
      '<cross-session-message from="uds:/tmp/cc-socks/1.sock" from-name="jake-panel">\nhello\nworld\n</cross-session-message>'
    );
    expect(parseWrapper(content)).toEqual({
      from: 'uds:/tmp/cc-socks/1.sock',
      fromName: 'jake-panel',
      body: 'hello\nworld',
    });
  });

  it('parses a reply as Claude Code sends it', () => {
    const content =
      '<cross-session-message from="uds:/tmp/cc-socks/57500.sock" from-name="inspector-jake-de" from-mode="bypass">\nok\n</cross-session-message>';
    expect(parseWrapper(content)).toEqual({
      from: 'uds:/tmp/cc-socks/57500.sock',
      fromName: 'inspector-jake-de',
      fromMode: 'bypass',
      body: 'ok',
    });
  });

  it('strips characters that would break the from-name attribute', () => {
    expect(wrapContent('uds:/x', 'a"b<c>', 'hi')).toContain('from-name="abc"');
  });

  it('encodes a frame Claude Code accepts', () => {
    const frame = JSON.parse(encodeFrame('uds:/tmp/cc-socks/1.sock', 'jake-panel', 'hi'));
    expect(frame).toMatchObject({
      msgV: 1,
      type: 'user',
      priority: 'next',
      from: 'uds:/tmp/cc-socks/1.sock',
      message: { role: 'user' },
    });
    expect(frame.msg_id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('turns user frames into inbound messages', () => {
    const line = encodeFrame('uds:/tmp/cc-socks/9.sock', 'other', 'reply text').trim();
    expect(parseFrameLine(line)).toEqual({
      kind: 'message',
      message: { from: 'uds:/tmp/cc-socks/9.sock', fromName: 'other', text: 'reply text' },
    });
  });

  it('reports delivery status control frames', () => {
    const line = JSON.stringify({
      type: 'control',
      action: 'peer_message_status',
      status: 'held',
      reason: 'awaiting approval',
    });
    expect(parseFrameLine(line)).toEqual({
      kind: 'status',
      status: { status: 'held', reason: 'awaiting approval' },
    });
  });

  it('ignores auth lines, other control frames and garbage', () => {
    expect(parseFrameLine(JSON.stringify({ type: 'auth', token: '00' }))).toBeNull();
    expect(parseFrameLine(JSON.stringify({ type: 'control', action: 'peer_idle_notice' }))).toBeNull();
    expect(parseFrameLine('not json')).toBeNull();
  });

  it('derives bridge names from the Claude Code session, else the MCP session', () => {
    expect(bridgeNameFor('jake', 'inspector-jake-de')).toBe('inspector-jake-de-panel');
    expect(bridgeNameFor('jake', 'Demo Video!')).toBe('demo-video-panel');
    expect(bridgeNameFor('jake')).toBe('jake-panel');
    expect(bridgeNameFor('jake', '***')).toBe('jake-panel');
    expect(bridgeNameFor('My Session!')).toBe('my-session-panel');
    expect(bridgeNameFor('***')).toBe('jake-panel');
  });
});

describe('createSessionBridge availability', () => {
  const noop = () => {};

  it('is unavailable outside a Claude Code session', async () => {
    const bridge = await createSessionBridge({
      sessionName: 'jake',
      version: 'test',
      onInbound: noop,
      onStatus: noop,
      env: {},
      platform: 'darwin',
    });
    expect(bridge.info().available).toBe(false);
    await expect(bridge.send('hi')).rejects.toThrow(/not started by a Claude Code session/);
  });

  it('is unavailable on platforms Claude Code messaging does not run on', async () => {
    const bridge = await createSessionBridge({
      sessionName: 'jake',
      version: 'test',
      onInbound: noop,
      onStatus: noop,
      env: { CLAUDE_CODE_MESSAGING_SOCKET: '/tmp/cc-socks/1.sock' },
      platform: 'freebsd',
    });
    expect(bridge.info()).toEqual({
      available: false,
      reason: 'Chat with the Claude Code session is not supported on freebsd.',
    });
  });
});

describe('Windows addressing', () => {
  const hex = 'ab'.repeat(16);

  it('recognises named pipes', () => {
    expect(isPipePath('\\\\.\\pipe\\LOCAL\\cc-msg-' + hex)).toBe(true);
    expect(isPipePath('//./pipe/cc-msg-' + hex)).toBe(true);
    expect(isPipePath('/tmp/cc-socks/1.sock')).toBe(false);
  });

  it('listens in the parent pipe namespace with a name Claude Code replies to', () => {
    expect(bridgeAddressFor('\\\\.\\pipe\\LOCAL\\cc-msg-' + 'cd'.repeat(16), 1, () => hex)).toBe(
      '\\\\.\\pipe\\LOCAL\\cc-msg-' + hex
    );
    expect(bridgeAddressFor('\\\\.\\pipe\\cc-msg-' + 'cd'.repeat(16), 1, () => hex)).toBe('\\\\.\\pipe\\cc-msg-' + hex);
    expect(bridgeAddressFor('/tmp/cc-socks/9.sock', 42)).toBe('/tmp/cc-socks/42.sock');
  });

  it('names the key file after the lowercased canonical pipe path', () => {
    const pipe = '\\\\.\\pipe\\LOCAL\\cc-msg-' + 'AB'.repeat(16);
    const canonical = '\\\\.\\pipe\\local\\cc-msg-' + hex;
    const digest = createHash('sha256').update(canonical).digest('hex');
    expect(keyFileName(4242, pipe)).toBe(`4242.${digest}.key`);
  });
});

describe('process identity, as Claude Code records it', () => {
  afterEach(() => vi.restoreAllMocks());

  it('uses platform and lowercased host name as the Windows pid domain', async () => {
    expect(await readPidDomain('win32')).toBe(`win32:${os.hostname().toLowerCase()}`);
  });

  it('reads the starttime field from /proc/<pid>/stat', () => {
    // Field 22 is starttime; the command name may contain spaces and parentheses
    const stat = '4242 (node (my app) x) S 1 4242 4242 0 -1 4194304 1 0 0 0 0 0 0 0 20 0 1 0 987654 12345 67 18446744073709551615';
    expect(parseStatStartTime(stat)).toBe('987654');
  });

  it('uses the bare platform name as the macOS pid domain', async () => {
    expect(await readPidDomain('darwin')).toBe('darwin');
  });

  it('combines machine-id and PID namespace for the Linux pid domain', async () => {
    vi.spyOn(fs.promises, 'readFile').mockResolvedValue('0123abcd\n' as any);
    vi.spyOn(fs.promises, 'readlink').mockResolvedValue('pid:[4026531836]' as any);
    expect(await readPidDomain('linux')).toBe('linux:0123abcd:pid:[4026531836]');
  });

  it('leaves missing Linux identity parts empty, as Claude Code does', async () => {
    // Containers often have no /etc/machine-id
    vi.spyOn(fs.promises, 'readFile').mockRejectedValue(new Error('ENOENT'));
    vi.spyOn(fs.promises, 'readlink').mockResolvedValue('pid:[4026533256]' as any);
    expect(await readPidDomain('linux')).toBe('linux::pid:[4026533256]');
  });
});

describe('createSessionBridge round trip', () => {
  const FAKE_PID = 424242;
  let dir: string;
  let parentSocket: string;
  let parentServer: net.Server;
  let parentFrames: string[];
  let bridge: SessionBridge;
  let inbound: InboundChat[];
  let statuses: DeliveryStatus[];
  let infoChanges: ChatBridgeInfo[];

  const registryDir = () => path.join(dir, 'config', 'sessions');
  const bridgeSocket = () => path.join(dir, `${FAKE_PID}.sock`);
  const registryFile = () => path.join(registryDir(), `${FAKE_PID}.json`);

  const writeToBridge = (data: string) =>
    new Promise<void>((resolve, reject) => {
      const conn = net.createConnection(bridgeSocket(), () => conn.end(data));
      conn.on('close', () => resolve());
      conn.on('error', reject);
    });

  const waitFor = async (check: () => boolean) => {
    for (let i = 0; i < 100 && !check(); i++) {
      await new Promise((r) => setTimeout(r, 10));
    }
    expect(check()).toBe(true);
  };

  beforeEach(async () => {
    // Unix socket paths are limited to ~103 bytes, so keep the temp dir short
    dir = fs.mkdtempSync('/tmp/ijb-');
    parentSocket = path.join(dir, 'parent.sock');
    parentFrames = [];
    inbound = [];
    statuses = [];
    infoChanges = [];

    parentServer = net.createServer((conn) => {
      let data = '';
      conn.on('data', (d) => (data += d));
      conn.on('end', () => parentFrames.push(data));
    });
    await new Promise<void>((resolve) => parentServer.listen(parentSocket, resolve));

    fs.mkdirSync(registryDir(), { recursive: true });
    fs.writeFileSync(
      path.join(registryDir(), '111.json'),
      JSON.stringify({ pid: 111, name: 'inspector-jake-de', messagingSocketPath: parentSocket })
    );

    bridge = await createSessionBridge({
      sessionName: 'jake',
      version: '9.9.9',
      onInbound: (m) => inbound.push(m),
      onStatus: (s) => statuses.push(s),
      onInfoChange: (info) => infoChanges.push(info),
      parentNamePollMs: 20,
      env: { CLAUDE_CODE_MESSAGING_SOCKET: parentSocket, CLAUDE_CONFIG_DIR: path.join(dir, 'config') },
      platform: 'darwin',
      pid: FAKE_PID,
      readProcStart: async () => 'Mon Oct 19 11:02:36 2026',
    });
  });

  afterEach(async () => {
    bridge.close();
    await new Promise<void>((resolve) => parentServer.close(() => resolve()));
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('registers itself without a kind so Claude Code does not treat it as an open session', () => {
    expect(bridge.info()).toEqual({ available: true, name: 'inspector-jake-de-panel', parentName: 'inspector-jake-de' });

    const record = JSON.parse(fs.readFileSync(registryFile(), 'utf8'));
    expect(record).toMatchObject({
      pid: FAKE_PID,
      procStart: 'Mon Oct 19 11:02:36 2026',
      pidDomain: 'darwin',
      version: 'inspector-jake-mcp@9.9.9',
      peerProtocol: 1,
      messagingSocketPath: bridgeSocket(),
      name: 'inspector-jake-de-panel',
      nameSource: 'user',
      status: 'idle',
    });
    expect(record).not.toHaveProperty('kind');
    expect(fs.statSync(bridgeSocket()).mode & 0o777).toBe(0o600);
  });

  const renameParent = (name: string) =>
    fs.writeFileSync(
      path.join(registryDir(), '111.json'),
      JSON.stringify({ pid: 111, name, messagingSocketPath: parentSocket })
    );

  it('follows the Claude Code session when it is renamed', async () => {
    renameParent('demo-video');
    await waitFor(() => infoChanges.length === 1);
    expect(infoChanges[0]).toEqual({ available: true, name: 'demo-video-panel', parentName: 'demo-video' });
    expect(JSON.parse(fs.readFileSync(registryFile(), 'utf8')).name).toBe('demo-video-panel');
  });

  it('adds the MCP session name when another session already has the name', async () => {
    fs.writeFileSync(path.join(registryDir(), '222.json'), JSON.stringify({ pid: 222, name: 'demo-video-panel' }));
    renameParent('demo-video');
    await waitFor(() => infoChanges.length === 1);
    expect(bridge.info().name).toBe('demo-video-jake-panel');
  });

  it('sends a frame to the parent session with its own reply address', async () => {
    await bridge.send('what did I select?');
    await waitFor(() => parentFrames.length === 1);

    const frame = JSON.parse(parentFrames[0]);
    expect(frame.from).toBe(`uds:${bridgeSocket()}`);
    expect(parseWrapper(frame.message.content)).toEqual({
      from: `uds:${bridgeSocket()}`,
      fromName: 'inspector-jake-de-panel',
      body: 'what did I select?',
    });
  });

  it('rejects when the parent session is gone', async () => {
    await new Promise<void>((resolve) => parentServer.close(() => resolve()));
    fs.rmSync(parentSocket, { force: true });
    await expect(bridge.send('hi')).rejects.toThrow(/Could not reach the Claude Code session/);
    // Recreate so afterEach can close it
    parentServer = net.createServer();
    await new Promise<void>((resolve) => parentServer.listen(parentSocket, resolve));
  });

  it('delivers replies and status receipts written to its socket', async () => {
    const reply = encodeFrame('uds:/tmp/cc-socks/111.sock', 'inspector-jake-de', 'You selected two buttons.');
    const status = JSON.stringify({ type: 'control', action: 'peer_message_status', status: 'held' }) + '\n';
    await writeToBridge(JSON.stringify({ type: 'auth', token: '0'.repeat(32) }) + '\n' + reply + status);

    await waitFor(() => inbound.length === 1 && statuses.length === 1);
    expect(inbound[0]).toEqual({
      from: 'uds:/tmp/cc-socks/111.sock',
      fromName: 'inspector-jake-de',
      text: 'You selected two buttons.',
    });
    expect(statuses[0]).toEqual({ status: 'held' });
  });

  it('handles a final frame without a trailing newline', async () => {
    await writeToBridge(encodeFrame('uds:/x', 'peer', 'no newline').trimEnd());
    await waitFor(() => inbound.length === 1);
    expect(inbound[0].text).toBe('no newline');
  });

  it('keeps its Claude Code name when the MCP session is renamed', () => {
    bridge.rename('annie');
    expect(bridge.info().name).toBe('inspector-jake-de-panel');
  });

  it('is named after the MCP session while the Claude Code session has no name', async () => {
    fs.rmSync(path.join(registryDir(), '111.json'));
    await waitFor(() => infoChanges.length === 1);
    expect(bridge.info().name).toBe('jake-panel');

    bridge.rename('annie');
    expect(JSON.parse(fs.readFileSync(registryFile(), 'utf8')).name).toBe('annie-panel');
    expect(bridge.info().name).toBe('annie-panel');
  });

  it('removes its socket and registry entry on close', () => {
    bridge.close();
    expect(fs.existsSync(bridgeSocket())).toBe(false);
    expect(fs.existsSync(registryFile())).toBe(false);
    // A second close is a no-op
    expect(() => bridge.close()).not.toThrow();
  });
});

describe('createSessionBridge on Linux', () => {
  it('registers with the Linux process identity', async () => {
    const dir = fs.mkdtempSync('/tmp/ijb-');
    const parentSocket = path.join(dir, 'parent.sock');
    const bridge = await createSessionBridge({
      sessionName: 'jake',
      version: '9.9.9',
      onInbound: () => {},
      onStatus: () => {},
      env: { CLAUDE_CODE_MESSAGING_SOCKET: parentSocket, CLAUDE_CONFIG_DIR: path.join(dir, 'config') },
      platform: 'linux',
      pid: 515151,
      readProcStart: async () => '987654',
      readPidDomain: async () => 'linux:0123abcd:pid:[4026531836]',
    });
    try {
      expect(bridge.info().available).toBe(true);
      const record = JSON.parse(fs.readFileSync(path.join(dir, 'config', 'sessions', '515151.json'), 'utf8'));
      expect(record).toMatchObject({
        procStart: '987654',
        pidDomain: 'linux:0123abcd:pid:[4026531836]',
        messagingSocketPath: path.join(dir, '515151.sock'),
      });
      expect(record).not.toHaveProperty('procStartFt');
    } finally {
      bridge.close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('createSessionBridge on Windows', () => {
  // Windows semantics (auth, key file, procStartFt) over a Unix socket, since tests can't open pipes here
  const FAKE_PID = 616161;
  const CHILD_TOKEN = 'c'.repeat(32);
  let dir: string;
  let parentSocket: string;
  let parentServer: net.Server;
  let parentFrames: string[];
  let inbound: InboundChat[];
  let bridge: SessionBridge;

  const sessionsDir = () => path.join(dir, 'config', 'sessions');
  const bridgeSocket = () => path.join(dir, `${FAKE_PID}.sock`);
  const keyPath = () => path.join(sessionsDir(), keyFileName(FAKE_PID, bridgeSocket()));

  const writeToBridge = (data: string) =>
    new Promise<void>((resolve) => {
      const conn = net.createConnection(bridgeSocket(), () => conn.end(data));
      conn.on('close', () => resolve());
      conn.on('error', () => resolve());
    });

  beforeEach(async () => {
    dir = fs.mkdtempSync('/tmp/ijw-');
    parentSocket = path.join(dir, 'parent.sock');
    parentFrames = [];
    inbound = [];
    parentServer = net.createServer((conn) => {
      let data = '';
      conn.on('data', (d) => (data += d));
      conn.on('end', () => parentFrames.push(data));
    });
    await new Promise<void>((resolve) => parentServer.listen(parentSocket, resolve));

    bridge = await createSessionBridge({
      sessionName: 'jake',
      version: '9.9.9',
      onInbound: (m) => inbound.push(m),
      onStatus: () => {},
      env: {
        CLAUDE_CODE_MESSAGING_SOCKET: parentSocket,
        CLAUDE_CODE_MESSAGING_TOKEN: CHILD_TOKEN,
        CLAUDE_CONFIG_DIR: path.join(dir, 'config'),
      },
      platform: 'win32',
      pid: FAKE_PID,
      readProcStart: async () => '639281234567890123',
      readPidDomain: async () => 'win32:jake-pc',
    });
  });

  afterEach(async () => {
    bridge.close();
    await new Promise<void>((resolve) => parentServer.close(() => resolve()));
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('records the start time as procStartFt and publishes a key file', () => {
    const record = JSON.parse(fs.readFileSync(path.join(sessionsDir(), `${FAKE_PID}.json`), 'utf8'));
    expect(record).toMatchObject({ procStartFt: '639281234567890123', pidDomain: 'win32:jake-pc' });
    expect(record).not.toHaveProperty('procStart');

    const key = JSON.parse(fs.readFileSync(keyPath(), 'utf8'));
    expect(key).toEqual({
      peerToken: expect.stringMatching(/^[0-9a-f]{32}$/),
      procStartFt: '639281234567890123',
      pidDomain: 'win32:jake-pc',
    });
  });

  it('opens each send with the child token Claude Code gave it', async () => {
    await bridge.send('hello');
    for (let i = 0; i < 100 && parentFrames.length === 0; i++) await new Promise((r) => setTimeout(r, 10));
    const [auth, frame] = parentFrames[0].split('\n');
    expect(JSON.parse(auth)).toEqual({ type: 'auth', token: CHILD_TOKEN });
    expect(parseWrapper(JSON.parse(frame).message.content)?.body).toBe('hello');
  });

  it('drops connections that do not present its token', async () => {
    await writeToBridge(encodeFrame('uds:/x', 'intruder', 'no auth'));
    await writeToBridge(authLine('0'.repeat(32)) + encodeFrame('uds:/x', 'intruder', 'wrong token'));
    await new Promise((r) => setTimeout(r, 50));
    expect(inbound).toEqual([]);
  });

  it('accepts replies that present its token', async () => {
    const { peerToken } = JSON.parse(fs.readFileSync(keyPath(), 'utf8'));
    await writeToBridge(authLine(peerToken) + encodeFrame('uds:/x', 'main', 'reply'));
    for (let i = 0; i < 100 && inbound.length === 0; i++) await new Promise((r) => setTimeout(r, 10));
    expect(inbound).toEqual([{ from: 'uds:/x', fromName: 'main', text: 'reply' }]);
  });

  it('removes its key file on close', () => {
    bridge.close();
    expect(fs.existsSync(keyPath())).toBe(false);
  });
});
