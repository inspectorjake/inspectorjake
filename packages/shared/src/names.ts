/**
 * Session name utilities for InspectorJake.
 * 4 predefined names scanned in order: jake, annie, kevin, elsa.
 */

export const SESSION_NAMES = [
  'jake', 'annie', 'kevin', 'elsa'
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

