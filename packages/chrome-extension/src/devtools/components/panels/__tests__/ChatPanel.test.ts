import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import type { ChatBridgeInfo, ChatEntry } from '@inspector-jake/shared';
import ChatPanel from '../ChatPanel.vue';

const baseProps = {
  messages: [] as ChatEntry[],
  bridgeInfo: { available: true, name: 'jake-panel', parentName: 'inspector-jake-de' } as ChatBridgeInfo | null,
  draft: '',
  sending: false,
  error: null as string | null,
  captureCount: 0,
  noteCount: 0,
};

const mountPanel = (props: Partial<typeof baseProps> = {}) =>
  mount(ChatPanel, { props: { ...baseProps, ...props } });

describe('ChatPanel', () => {
  it('shows an empty state naming the attached session', () => {
    const wrapper = mountPanel();
    expect(wrapper.get('[data-testid="chat-empty"]').text()).toContain('Ask inspector-jake-de about this page.');
  });

  it('renders your messages, replies and system notices', () => {
    const wrapper = mountPanel({
      messages: [
        { id: '1', role: 'you', text: 'what is this?', ts: 0, attachments: 2, status: 'sent' },
        { id: '2', role: 'claude', text: 'A pricing card.', ts: 0, fromName: 'inspector-jake-de' },
        { id: '3', role: 'system', text: 'Held for approval in the Claude Code terminal.', ts: 0 },
      ],
    });

    const rows = wrapper.findAll('[data-testid="chat-message"]');
    expect(rows.map((r) => r.attributes('data-role'))).toEqual(['you', 'claude', 'system']);
    expect(rows[0].text()).toContain('2 captures');
    expect(rows[1].text()).toContain('inspector-jake-de');
    expect(rows[1].text()).toContain('A pricing card.');
    expect(rows[2].text()).toContain('Held for approval');
  });

  it('shows thumbnails of what was sent, marking captures with notes', () => {
    const thumbnails = [
      { id: 'a', src: 'data:image/webp;base64,AAAA', label: '<button>', note: 'Make it orange' },
      { id: 'b', src: '', label: 'Region' },
      { id: 'c', src: 'data:image/webp;base64,BBBB', label: '<h1>' },
      { id: 'd', src: 'data:image/webp;base64,CCCC', label: '<nav>' },
      { id: 'e', src: 'data:image/webp;base64,DDDD', label: '<img>' },
    ];
    const wrapper = mountPanel({
      messages: [{ id: '1', role: 'you', text: 'Make the changes in my notes.', ts: 0, attachments: 5, thumbnails, status: 'sent' }],
    });

    const group = wrapper.get('[data-testid="chat-thumbnails"]');
    expect(group.attributes('aria-label')).toBe('5 captures');
    const tiles = group.findAll('[data-testid="chat-thumbnail"]');
    expect(tiles).toHaveLength(4);
    expect(tiles[0].get('img').attributes('src')).toBe('data:image/webp;base64,AAAA');
    expect(tiles[0].attributes('title')).toBe('<button> · “Make it orange”');
    // No image: the label stands in
    expect(tiles[1].find('img').exists()).toBe(false);
    expect(tiles[1].text()).toBe('Region');
    expect(group.text()).toContain('+1');
    // Thumbnails replace the count pill
    expect(wrapper.get('[data-testid="chat-message"]').text()).not.toContain('5 captures');
  });

  it('shows why a message was not sent', () => {
    const wrapper = mountPanel({
      messages: [{ id: '1', role: 'you', text: 'hi', ts: 0, status: 'failed', error: 'session is gone' }],
    });
    expect(wrapper.get('[data-testid="chat-message"]').text()).toContain('not sent: session is gone');
  });

  it('summarises what will be attached', () => {
    expect(mountPanel().get('[data-testid="chat-attachments"]').text()).toBe('No captures attached');
    expect(mountPanel({ captureCount: 1 }).get('[data-testid="chat-attachments"]').text()).toBe('Includes 1 capture');
    expect(mountPanel({ captureCount: 3, noteCount: 2 }).get('[data-testid="chat-attachments"]').text()).toBe(
      'Includes 3 captures (2 with notes)'
    );
  });

  it('updates the draft as you type', async () => {
    const wrapper = mountPanel();
    await wrapper.get('[data-testid="chat-input"]').setValue('hello');
    expect(wrapper.emitted('update:draft')?.at(-1)).toEqual(['hello']);
  });

  it('sends with the button and with Cmd/Ctrl+Enter', async () => {
    const wrapper = mountPanel({ draft: 'hello' });
    await wrapper.get('[data-testid="chat-send"]').trigger('click');
    await wrapper.get('[data-testid="chat-input"]').trigger('keydown', { key: 'Enter', metaKey: true });
    await wrapper.get('[data-testid="chat-input"]').trigger('keydown', { key: 'Enter', ctrlKey: true });
    // Plain Enter inserts a newline instead of sending
    await wrapper.get('[data-testid="chat-input"]').trigger('keydown', { key: 'Enter' });
    expect(wrapper.emitted('send')).toHaveLength(3);
  });

  it('does not send an empty draft or while sending', async () => {
    const empty = mountPanel({ draft: '   ' });
    expect(empty.get('[data-testid="chat-send"]').attributes('disabled')).toBeDefined();

    const busy = mountPanel({ draft: 'hi', sending: true });
    await busy.get('[data-testid="chat-input"]').trigger('keydown', { key: 'Enter', metaKey: true });
    expect(busy.emitted('send')).toBeUndefined();
  });

  it('explains when chat is unavailable and disables the composer', () => {
    const wrapper = mountPanel({
      draft: 'hi',
      bridgeInfo: { available: false, reason: 'Chat is only supported on macOS (this is linux).' },
    });
    expect(wrapper.get('[data-testid="chat-unavailable"]').text()).toContain('only supported on macOS');
    expect(wrapper.get('[data-testid="chat-input"]').attributes('disabled')).toBeDefined();
    expect(wrapper.get('[data-testid="chat-send"]').attributes('disabled')).toBeDefined();
  });

  it('shows the last send error', () => {
    const wrapper = mountPanel({ error: 'Not connected to an MCP session.' });
    expect(wrapper.get('[data-testid="chat-error"]').text()).toBe('Not connected to an MCP session.');
  });
});
