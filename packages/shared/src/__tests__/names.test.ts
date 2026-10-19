/**
 * Tests for session names and their ports.
 */

import { describe, it, expect } from 'vitest';
import { SESSION_NAMES, SESSION_PORTS, getDiscoveryPorts, nameToPort } from '../names.js';

describe('SESSION_NAMES', () => {
  it('has 100 distinct names', () => {
    expect(SESSION_NAMES).toHaveLength(100);
    expect(new Set(SESSION_NAMES).size).toBe(100);
  });

  it('keeps the original four names first, on their original ports', () => {
    expect(SESSION_NAMES.slice(0, 4)).toEqual(['jake', 'annie', 'kevin', 'elsa']);
    expect(SESSION_PORTS.jake).toBe(52192);
    expect(SESSION_PORTS.annie).toBe(52992);
    expect(SESSION_PORTS.kevin).toBe(57490);
    expect(SESSION_PORTS.elsa).toBe(54746);
  });

  it('maps every name to a different port in 50000-59999', () => {
    const ports = SESSION_NAMES.map(nameToPort);
    expect(new Set(ports).size).toBe(SESSION_NAMES.length);
    for (const port of ports) {
      expect(port).toBeGreaterThanOrEqual(50000);
      expect(port).toBeLessThan(60000);
    }
  });

  it('avoids well-known local ports', () => {
    const wellKnown = [50000, 50051, 50070, 50075, 51413, 54321, 54322, 54323, 54324, 54325, 54326, 54327, 55432, 57621, 58080];
    for (const name of SESSION_NAMES) {
      expect(wellKnown).not.toContain(nameToPort(name));
    }
  });

  it('scans every name, in order', () => {
    const ports = getDiscoveryPorts();
    expect(ports.map((p) => p.name)).toEqual([...SESSION_NAMES]);
    expect(ports[0]).toEqual({ name: 'jake', port: 52192 });
  });
});
