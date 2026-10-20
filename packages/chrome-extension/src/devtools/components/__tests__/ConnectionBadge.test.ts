import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ConnectionBadge from '../ConnectionBadge.vue';

describe('ConnectionBadge', () => {
  const mountBadge = (props: Record<string, unknown> = {}) =>
    mount(ConnectionBadge, {
      props: { isConnected: true, sessionName: 'annie', connecting: false, ...props },
    });

  it('names the session after its Claude Code session', () => {
    const badge = mountBadge({ claudeSession: 'inspector-jake-de' }).get('[data-testid="connection-badge"]');
    expect(badge.get('[data-testid="connection-name"]').text()).toBe('inspector-jake-de');
    expect(badge.text()).not.toContain('annie');
    expect(badge.attributes('title')).toBe(
      'Connected to Claude Code session inspector-jake-de (Inspector Jake session annie)'
    );
  });

  it('falls back to the Inspector Jake session name', () => {
    const badge = mountBadge({ claudeSession: null }).get('[data-testid="connection-badge"]');
    expect(badge.get('[data-testid="connection-name"]').text()).toBe('annie');
    expect(badge.attributes('title')).toBe('Connected to annie');
  });
});
