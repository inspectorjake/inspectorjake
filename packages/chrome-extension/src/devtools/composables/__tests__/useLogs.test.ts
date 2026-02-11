import { describe, it, expect } from 'vitest';
import { useLogs } from '../useLogs.js';

describe('useLogs', () => {
  it('hides logs by default', () => {
    const { showLogs } = useLogs();
    expect(showLogs.value).toBe(false);
  });

  it('toggles logs visibility', () => {
    const { showLogs, toggleLogs } = useLogs();
    toggleLogs();
    expect(showLogs.value).toBe(true);
  });
});
