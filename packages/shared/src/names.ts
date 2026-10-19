/**
 * Session name utilities for InspectorJake.
 * 100 predefined names, tried in order by the MCP server and all scanned by the extension.
 */

/**
 * Predefined session names. The first four keep their original ports, so existing
 * setups behave as before. Every name hashes to a different port, and none lands on a
 * well-known local port (gRPC 50051, BitTorrent 51413, Supabase 54321-54327, ...).
 * Append new names at the end, and only after checking their ports with nameToPort.
 */
export const SESSION_NAMES = [
  'jake', 'annie', 'kevin', 'elsa', 'max', 'luna', 'leo', 'mia', 'sam', 'zoe',
  'theo', 'ivy', 'finn', 'ruby', 'owen', 'eli', 'maya', 'jack', 'lily', 'noah',
  'emma', 'liam', 'ava', 'ben', 'cleo', 'milo', 'iris', 'hugo', 'june', 'otto',
  'rose', 'ezra', 'hazel', 'axel', 'jade', 'ian', 'lola', 'kai', 'nina', 'gus',
  'vera', 'abe', 'dora', 'cal', 'fern', 'dex', 'gwen', 'ray', 'tess', 'lou',
  'beth', 'roy', 'cora', 'ned', 'faye', 'joel', 'lena', 'seth', 'mae', 'tom',
  'nell', 'vic', 'opal', 'wade', 'rhea', 'zack', 'lucy', 'ross', 'hank', 'wren',
  'boyd', 'dana', 'kurt', 'edie', 'dean', 'lara', 'neil', 'tina', 'glen', 'mona',
  'carl', 'jane', 'wes', 'rita', 'evan', 'gina', 'jude', 'kate', 'ari', 'bea',
  'cole', 'dina', 'jay', 'kim', 'luke', 'meg', 'nick', 'pam', 'rob', 'sue',
] as const;

export type SessionName = typeof SESSION_NAMES[number];

const BASE_PORT = 50000;
const PORT_RANGE = 10000;

/**
 * Converts a session name to a deterministic port number.
 * Uses djb2 hash algorithm for consistent results.
 */
export function nameToPort(name: string): number {
  let hash = 5381;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) + hash) + name.charCodeAt(i);
  }
  return BASE_PORT + (Math.abs(hash) % PORT_RANGE);
}

/**
 * Pre-computed port mappings for all session names.
 * Extension uses this to scan for active servers.
 */
export const SESSION_PORTS: Record<SessionName, number> = SESSION_NAMES.reduce(
  (acc, name) => {
    acc[name] = nameToPort(name);
    return acc;
  },
  {} as Record<SessionName, number>
);

/**
 * Get all ports that need to be scanned for discovery.
 */
export function getDiscoveryPorts(): Array<{ name: SessionName; port: number }> {
  return SESSION_NAMES.map(name => ({
    name,
    port: SESSION_PORTS[name]
  }));
}

