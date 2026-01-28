/**
 * Port scanning discovery for finding active InspectorJake MCP servers.
 * Scans all 20 predefined ports to find available sessions.
 */

import { getDiscoveryPorts, type SessionName } from '@inspector-jake/shared';
import type { DiscoveryResponse } from '@inspector-jake/shared';

export interface DiscoveredSession {
  name: SessionName;
  port: number;
  status: 'ready' | 'connected';
  connectedTab?: {
    id: number;
    title: string;
    url: string;
  };
}

/**
 * Scan all predefined ports to find active MCP servers.
 * Returns list of discovered sessions within timeout.
 */
export async function discoverSessions(timeoutMs: number = 500): Promise<DiscoveredSession[]> {
  const ports = getDiscoveryPorts();
  const sessions: DiscoveredSession[] = [];

  // Scan all ports in parallel
  const scanPromises = ports.map(async ({ name, port }) => {
    try {
      const result = await scanPort(name, port, timeoutMs);
      if (result) {
        sessions.push(result);
      }
    } catch {
      // Port not responding, skip
    }
  });

  await Promise.all(scanPromises);

  return sessions;
}

/**
 * Check if a port is alive via HTTP health endpoint.
 * HTTP fetch failures are silent (no console errors), unlike WebSocket.
 */
async function isPortAlive(port: number, timeoutMs: number): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(`http://127.0.0.1:${port}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    return response.ok;
  } catch {
    // Port not responding - this is silent, no console error
    return false;
  }
}

/**
 * Scan a single port for an active MCP server.
 * Uses HTTP pre-check to avoid WebSocket connection errors in console.
 */
async function scanPort(
  name: SessionName,
  port: number,
  timeoutMs: number
): Promise<DiscoveredSession | null> {
  // First, silent HTTP check to see if port is alive
  const halfTimeout = Math.floor(timeoutMs / 2);
  const alive = await isPortAlive(port, halfTimeout);
  if (!alive) {
    return null;
  }

  // Port is alive, now do WebSocket handshake for full discovery info
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/discovery`);

    const timeout = setTimeout(() => {
      ws.close();
      resolve(null);
    }, halfTimeout);

    ws.onmessage = (event) => {
      clearTimeout(timeout);
      try {
        const data = JSON.parse(event.data) as DiscoveryResponse;
        resolve({
          name,
          port,
          status: data.status,
          connectedTab: data.connectedTab,
        });
      } catch {
        resolve(null);
      }
      ws.close();
    };

    ws.onerror = () => {
      clearTimeout(timeout);
      resolve(null);
    };

    ws.onclose = () => {
      clearTimeout(timeout);
    };
  });
}
