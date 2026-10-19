/**
 * Session bridge: lets the DevTools panel chat with the Claude Code session that spawned this server.
 *
 * Claude Code sessions on one machine message each other over Unix sockets (named pipes on Windows).
 * Each session listens on `<socket dir>/<pid>.sock` (`\\.\pipe\LOCAL\cc-msg-<hex>` on Windows) and
 * registers itself in `<config dir>/sessions/<pid>.json`, which is how names resolve to sockets.
 * The bridge does the same, so the attached session can reply to it by name.
 *
 * On Windows every connection must open with an auth line, and a session publishes
 * `<pid>.<sha256 of its pipe>.key` holding the token senders present to it.
 *
 * This is Claude Code's internal peer protocol (observed in Claude Code 2.1.303), not a public API.
 */

import net from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { ChatBridgeInfo } from '@inspector-jake/shared';
import { log } from './logger.js';

const execFileAsync = promisify(execFile);

const SEND_TIMEOUT_MS = 5000;
/** Claude Code's own client half-closes this long after writing. */
const HALF_CLOSE_DELAY_MS = 150;
/** Larger than Claude Code's 1 MiB per-message limit, so a valid frame always fits. */
const MAX_INBOUND_BUFFER = 2 * 1024 * 1024;
const WRAPPER_TAG = 'cross-session-message';

const WRAPPER_RE = new RegExp(
  `^<${WRAPPER_TAG}` +
    '(?: from="([^"]+)")?' +
    '(?: from-session="([^"]+)")?' +
    '(?: hop-chain="([^"]+)")?' +
    '(?: from-name="([^"<>\\n\\r]+)")?' +
    '(?: from-mode="([^"]+)")?' +
    '(?: from-plugin="([^"<>\\n\\r]+)")?' +
    `>\\n([\\s\\S]*)\\n</${WRAPPER_TAG}>$`
);

export interface InboundChat {
  from: string;
  fromName?: string;
  text: string;
}

export interface DeliveryStatus {
  status: string;
  reason?: string;
}

export interface SessionBridge {
  info: () => ChatBridgeInfo;
  /** Send a message body to the attached Claude Code session. */
  send: (body: string) => Promise<void>;
  /** Re-register under a new name. */
  rename: (name: string) => void;
  /** Remove the socket and registry entry. Safe to call more than once. */
  close: () => void;
}

export interface SessionBridgeOptions {
  name: string;
  version: string;
  onInbound: (message: InboundChat) => void;
  onStatus: (status: DeliveryStatus) => void;
  /** Overrides for tests */
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  pid?: number;
  readProcStart?: (pid: number) => Promise<string>;
  readPidDomain?: () => Promise<string>;
}

const PIPE_RE = /^[\\/]{2}[.?][\\/]pipe[\\/](?:(LOCAL)[\\/])?([^\\/]+)$/i;

/** Whether a messaging address is a Windows named pipe. */
export function isPipePath(address: string): boolean {
  return PIPE_RE.test(address);
}

/**
 * Where the bridge listens: beside the parent session, because Claude Code only replies inside
 * its own namespace. Unix: `<parent dir>/<pid>.sock`. Windows: a pipe in the parent's pipe
 * namespace named `cc-msg-<32 hex>`, the only pipe names Claude Code replies to.
 */
export function bridgeAddressFor(
  parentSocket: string,
  pid: number,
  randomHex: () => string = () => randomBytes(16).toString('hex')
): string {
  const pipe = PIPE_RE.exec(parentSocket);
  if (pipe) {
    return `\\\\.\\pipe\\${pipe[1] ? 'LOCAL\\' : ''}cc-msg-${randomHex()}`;
  }
  return path.join(path.dirname(parentSocket), `${pid}.sock`);
}

/**
 * Name of the auth key file Claude Code looks for: `<pid>.<sha256 of the canonical address>.key`.
 * A pipe's canonical form is `\\.\pipe\` plus its name with A-Z lowercased.
 */
export function keyFileName(pid: number, address: string): string {
  const pipe = PIPE_RE.exec(address);
  const canonical = pipe
    ? `\\\\.\\pipe\\${(pipe[1] ? `LOCAL\\${pipe[2]}` : pipe[2]).replace(/[A-Z]/g, (c) => c.toLowerCase())}`
    : path.resolve(address);
  return `${pid}.${createHash('sha256').update(canonical).digest('hex')}.key`;
}

/** First line of a connection to a session that requires auth. */
export function authLine(token: string): string {
  return JSON.stringify({ type: 'auth', token }) + '\n';
}

function tokensMatch(presented: unknown, expected: string): boolean {
  if (typeof presented !== 'string' || presented.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(presented), Buffer.from(expected));
}

/** Name the bridge registers under for a given MCP session name, e.g. "jake" -> "jake-panel". */
export function bridgeNameFor(sessionName: string): string {
  const slug = sessionName.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  return `${slug || 'jake'}-panel`;
}

// ---------------------------------------------------------------------------
// Wire format
// ---------------------------------------------------------------------------

/**
 * Address form Claude Code uses for a socket path: `uds:` plus the path, with any byte
 * outside [A-Za-z0-9:_/.\-] percent-encoded.
 */
export function socketAddress(socketPath: string): string {
  const encoded = socketPath.replace(/[^A-Za-z0-9:_/.\\-]/gu, (ch) =>
    Array.from(Buffer.from(ch, 'utf8'), (b) => `%${b.toString(16).toUpperCase().padStart(2, '0')}`).join('')
  );
  return `uds:${encoded}`;
}

/** Wrap a body the way Claude Code wraps cross-session messages. */
export function wrapContent(from: string, fromName: string | undefined, body: string): string {
  const attrs = [`from="${from}"`];
  const name = fromName?.replace(/["<>\n\r]/g, '');
  if (name) attrs.push(`from-name="${name}"`);
  return `<${WRAPPER_TAG} ${attrs.join(' ')}>\n${body}\n</${WRAPPER_TAG}>`;
}

/** One NDJSON line carrying a chat message. */
export function encodeFrame(from: string, fromName: string | undefined, body: string): string {
  return (
    JSON.stringify({
      msgV: 1,
      msg_id: randomUUID(),
      type: 'user',
      message: { role: 'user', content: wrapContent(from, fromName, body) },
      priority: 'next',
      from,
    }) + '\n'
  );
}

export interface ParsedWrapper {
  from?: string;
  fromSession?: string;
  fromName?: string;
  fromMode?: string;
  fromPlugin?: string;
  body: string;
}

export function parseWrapper(content: string): ParsedWrapper | null {
  const m = content.match(WRAPPER_RE);
  if (!m) return null;
  return {
    ...(m[1] !== undefined && { from: m[1] }),
    ...(m[2] !== undefined && { fromSession: m[2] }),
    ...(m[4] !== undefined && { fromName: m[4] }),
    ...(m[5] !== undefined && { fromMode: m[5] }),
    ...(m[6] !== undefined && { fromPlugin: m[6] }),
    body: m[7],
  };
}

export type ParsedFrame =
  | { kind: 'message'; message: InboundChat }
  | { kind: 'status'; status: DeliveryStatus };

/**
 * Interpret one line received on the bridge socket. Auth lines and frames
 * the panel has no use for return null.
 */
export function parseFrameLine(line: string): ParsedFrame | null {
  let frame: any;
  try {
    frame = JSON.parse(line);
  } catch {
    return null;
  }
  if (!frame || typeof frame !== 'object') return null;

  if (frame.type === 'user') {
    const content = frame.message?.content;
    if (typeof content !== 'string') return null;
    const wrapped = parseWrapper(content);
    const from = wrapped?.from ?? (typeof frame.from === 'string' ? frame.from : 'unknown');
    return {
      kind: 'message',
      message: {
        from,
        ...(wrapped?.fromName && { fromName: wrapped.fromName }),
        text: wrapped ? wrapped.body : content,
      },
    };
  }

  if (frame.type === 'control' && frame.action === 'peer_message_status' && typeof frame.status === 'string') {
    return {
      kind: 'status',
      status: {
        status: frame.status,
        ...(typeof frame.reason === 'string' && { reason: frame.reason }),
      },
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/**
 * Field 22 (starttime, in clock ticks since boot) of /proc/<pid>/stat. The command
 * name in field 2 can contain spaces, so split after its closing parenthesis.
 */
export function parseStatStartTime(stat: string): string | undefined {
  return stat.slice(stat.lastIndexOf(')') + 2).split(' ')[19];
}

/**
 * Run one PowerShell command and return its trimmed stdout. stdin is closed up front:
 * PowerShell waits for a piped stdin to end before it exits.
 */
function runPowerShell(command: string, timeoutMs = 10000): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], {
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
    });
    let stdout = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('PowerShell timed out'));
    }, timeoutMs);
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => (stdout += chunk));
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(`PowerShell exited with code ${code}`));
    });
  });
}

/**
 * Process start time as Claude Code records it (`procStart`; `procStartFt` on Windows).
 * Claude Code re-reads it to decide whether a record is live, so it must match:
 * - macOS: `ps -o lstart=` in UTC, C locale
 * - Linux: the starttime field of /proc/<pid>/stat
 * - Windows: the creation time's .NET ticks, read with Claude Code's own PowerShell fallback.
 *   Claude Code itself may read FILETIME instead; it treats the two formats as equal.
 */
export async function readProcStart(pid: number, platform: NodeJS.Platform = process.platform): Promise<string> {
  if (platform === 'linux') {
    const stat = await fs.promises.readFile(`/proc/${pid}/stat`, 'utf8');
    return parseStatStartTime(stat) ?? '';
  }
  if (platform === 'win32') {
    return runPowerShell(`(Get-CimInstance Win32_Process -Filter "ProcessId=${pid}").CreationDate.Ticks`);
  }
  const { stdout } = await execFileAsync('ps', ['-o', 'lstart=', '-p', String(pid)], {
    env: { ...process.env, LC_ALL: 'C', TZ: 'UTC' },
    timeout: 2000,
  });
  return stdout.trim();
}

/**
 * The `pidDomain` Claude Code stamps on records; records from another domain are ignored.
 * - macOS: the platform name
 * - Linux (WSL too): platform, machine-id and PID namespace, so containers don't mix
 * - Windows: platform and lowercased host name
 */
export async function readPidDomain(platform: NodeJS.Platform = process.platform): Promise<string> {
  if (platform === 'win32') return `win32:${os.hostname().toLowerCase()}`;
  if (platform !== 'linux') return platform;
  const [machineId, pidNamespace] = await Promise.all([
    fs.promises.readFile('/etc/machine-id', 'utf8').then((s) => s.trim(), () => ''),
    fs.promises.readlink('/proc/self/ns/pid').catch(() => ''),
  ]);
  return `linux:${machineId}:${pidNamespace}`;
}

function writeFileAtomic(file: string, data: string): void {
  const tmp = `${file}.tmp.${process.pid}`;
  fs.writeFileSync(tmp, data, { mode: 0o600 });
  fs.renameSync(tmp, file);
}

/** Name of the registered session listening on `socketPath`, if any. */
function findSessionName(registryDir: string, socketPath: string): string | undefined {
  let files: string[];
  try {
    files = fs.readdirSync(registryDir).filter((f) => /^\d+\.json$/.test(f));
  } catch {
    return undefined;
  }
  for (const file of files) {
    try {
      const record = JSON.parse(fs.readFileSync(path.join(registryDir, file), 'utf8'));
      if (record.messagingSocketPath === socketPath && typeof record.name === 'string') {
        return record.name;
      }
    } catch {
      // Torn or foreign record - skip
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Bridge
// ---------------------------------------------------------------------------

function unavailableBridge(reason: string): SessionBridge {
  log.info('Bridge', `Chat bridge unavailable: ${reason}`);
  return {
    info: () => ({ available: false, reason }),
    send: () => Promise.reject(new Error(reason)),
    rename: () => {},
    close: () => {},
  };
}

/** Resolve whether something is accepting connections on a socket path. */
function isSocketLive(socketPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = net.createConnection(socketPath);
    const done = (live: boolean) => {
      probe.destroy();
      resolve(live);
    };
    probe.once('connect', () => done(true));
    probe.once('error', () => done(false));
    probe.setTimeout(250, () => done(false));
  });
}

function listen(server: net.Server, socketPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(socketPath, () => {
      server.off('error', reject);
      resolve();
    });
  });
}

/**
 * Register this process as a peer session and start listening for replies.
 * Never throws: when chat can't work here, the returned bridge reports why.
 */
export async function createSessionBridge(opts: SessionBridgeOptions): Promise<SessionBridge> {
  const env = opts.env ?? process.env;
  const platform = opts.platform ?? process.platform;
  const pid = opts.pid ?? process.pid;
  const parentSocket = env.CLAUDE_CODE_MESSAGING_SOCKET;

  if (!parentSocket) {
    return unavailableBridge('This MCP server was not started by a Claude Code session with cross-session messaging.');
  }
  if (platform !== 'darwin' && platform !== 'linux' && platform !== 'win32') {
    return unavailableBridge(`Chat with the Claude Code session is not supported on ${platform}.`);
  }

  // Windows sessions require an auth line on every connection, in both directions
  const authRequired = platform === 'win32';
  const peerToken = randomBytes(16).toString('hex');
  const usesPipe = isPipePath(parentSocket);
  const socketPath = bridgeAddressFor(parentSocket, pid);
  const registryDir = path.join(env.CLAUDE_CONFIG_DIR ?? path.join(os.homedir(), '.claude'), 'sessions');
  const registryFile = path.join(registryDir, `${pid}.json`);
  const keyFile = authRequired ? path.join(registryDir, keyFileName(pid, socketPath)) : undefined;
  const from = socketAddress(socketPath);

  let name = opts.name;
  let nameSince = Date.now();
  let closed = false;

  const server = net.createServer((conn) => {
    let buffer = '';
    let authed = !authRequired;
    const handleLine = (line: string) => {
      if (!line.trim()) return;
      if (!authed) {
        // The first line must present this bridge's token; anything else ends the connection
        let frame: any;
        try {
          frame = JSON.parse(line);
        } catch {
          frame = undefined;
        }
        if (frame?.type === 'auth' && tokensMatch(frame.token, peerToken)) {
          authed = true;
        } else {
          log.warn('Bridge', 'Rejected an inbound connection without a valid auth line');
          conn.destroy();
        }
        return;
      }
      const parsed = parseFrameLine(line);
      if (parsed?.kind === 'message') opts.onInbound(parsed.message);
      if (parsed?.kind === 'status') opts.onStatus(parsed.status);
    };
    conn.setEncoding('utf8');
    conn.on('data', (chunk: string) => {
      buffer += chunk;
      if (buffer.length > MAX_INBOUND_BUFFER) {
        log.warn('Bridge', 'Inbound frame too large, dropping connection');
        conn.destroy();
        return;
      }
      let newline: number;
      while (!conn.destroyed && (newline = buffer.indexOf('\n')) !== -1) {
        handleLine(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
      }
    });
    conn.on('end', () => {
      if (!conn.destroyed) handleLine(buffer);
      conn.end();
    });
    conn.on('error', (err) => log.warn('Bridge', 'Inbound connection error:', err.message));
  });

  // Pipes have no file to clean up or chmod; their random names never collide
  const removeSocket = () => {
    if (!usesPipe) fs.rmSync(socketPath, { force: true });
  };

  try {
    if (!usesPipe && fs.existsSync(socketPath)) {
      if (await isSocketLive(socketPath)) {
        return unavailableBridge(`Another process is already listening on ${socketPath}.`);
      }
      fs.unlinkSync(socketPath);
    }
    await listen(server, socketPath);
    if (!usesPipe) fs.chmodSync(socketPath, 0o600);
  } catch (err) {
    server.close();
    return unavailableBridge(`Could not listen on ${socketPath}: ${(err as Error).message}`);
  }

  let procStart: string;
  let pidDomain: string;
  try {
    procStart = await (opts.readProcStart ?? ((p: number) => readProcStart(p, platform)))(pid);
    if (!procStart) throw new Error('empty process start time');
    pidDomain = await (opts.readPidDomain ?? (() => readPidDomain(platform)))();
  } catch (err) {
    server.close();
    removeSocket();
    return unavailableBridge(`Could not read this process's start time: ${(err as Error).message}`);
  }

  // Windows records the start time as procStartFt; Claude Code ignores procStart there
  const startField = platform === 'win32' ? { procStartFt: procStart } : { procStart };

  const startedAt = Date.now();
  const writeRecord = () => {
    const now = Date.now();
    // No `kind`: Claude Code's resume logic treats interactive/bg entries as open sessions in `cwd`.
    const record = {
      pid,
      cwd: process.cwd(),
      startedAt,
      ...startField,
      version: `inspector-jake-mcp@${opts.version}`,
      peerProtocol: 1,
      peerFeatures: [],
      entrypoint: 'inspector-jake',
      pidDomain,
      messagingSocketPath: socketPath,
      name,
      nameSource: 'user',
      nameSince,
      status: 'idle',
      updatedAt: now,
      statusUpdatedAt: now,
    };
    writeFileAtomic(registryFile, JSON.stringify(record));
  };

  try {
    fs.mkdirSync(registryDir, { recursive: true, mode: 0o700 });
    if (keyFile) {
      // Senders on Windows refuse a pipe with no key file
      writeFileAtomic(keyFile, JSON.stringify({ peerToken, ...startField, pidDomain }));
    }
    writeRecord();
  } catch (err) {
    server.close();
    removeSocket();
    if (keyFile) fs.rmSync(keyFile, { force: true });
    return unavailableBridge(`Could not register in ${registryDir}: ${(err as Error).message}`);
  }

  log.info('Bridge', `Registered as "${name}" on ${socketPath}`);

  return {
    info: () => ({
      available: true,
      name,
      parentName: findSessionName(registryDir, parentSocket),
    }),

    send: (body: string) =>
      new Promise<void>((resolve, reject) => {
        const conn = net.createConnection(parentSocket);
        let failed = false;
        const fail = (message: string) => {
          if (failed) return;
          failed = true;
          clearTimeout(timer);
          conn.destroy();
          reject(new Error(message));
        };
        const timer = setTimeout(() => fail('Timed out sending to the Claude Code session.'), SEND_TIMEOUT_MS);

        conn.on('connect', () => {
          // On Windows, present the token Claude Code gave its child processes
          const childToken = env.CLAUDE_CODE_MESSAGING_TOKEN;
          const auth = authRequired && childToken ? authLine(childToken) : '';
          conn.write(auth + encodeFrame(from, name, body), () => {
            setTimeout(() => conn.end(), HALF_CLOSE_DELAY_MS);
          });
        });
        conn.on('error', (err) => fail(`Could not reach the Claude Code session: ${err.message}`));
        conn.on('close', () => {
          if (failed) return;
          clearTimeout(timer);
          resolve();
        });
        conn.resume();
      }),

    rename: (newName: string) => {
      if (closed || newName === name) return;
      name = newName;
      nameSince = Date.now();
      try {
        writeRecord();
        log.info('Bridge', `Re-registered as "${name}"`);
      } catch (err) {
        log.warn('Bridge', 'Could not update registry entry:', (err as Error).message);
      }
    },

    close: () => {
      if (closed) return;
      closed = true;
      server.close();
      removeSocket();
      fs.rmSync(registryFile, { force: true });
      if (keyFile) fs.rmSync(keyFile, { force: true });
    },
  };
}
