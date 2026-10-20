import { describe, it, expect } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import CapturesSidebar from '../CapturesSidebar.vue';

const elementSelection = {
  id: 'elem-1',
  type: 'element',
  timestamp: Date.now(),
  image: 'data:image/png;base64,abc',
  width: 120,
  height: 48,
  selector: 'main > button',
  tagName: 'button',
  className: 'cta',
  rect: { x: 0, y: 0, width: 120, height: 48 },
  attributes: [],
};

describe('CapturesSidebar', () => {
  it('forwards hover events from CaptureCard', async () => {
    const wrapper = shallowMount(CapturesSidebar, {
      props: {
        selections: [elementSelection] as any,
        expandedId: null,
        isConnected: true,
        sessions: [],
        scanning: false,
        connecting: false,
        isPicking: false,
        isCoolingDown: false,
      },
      global: {
        stubs: {
          CaptureCard: {
            emits: ['hover-start', 'hover-end'],
            template: `
              <div>
                <button class="hover-start" @click="$emit('hover-start')" />
                <button class="hover-end" @click="$emit('hover-end')" />
              </div>
            `,
          },
        },
      },
    });

    await wrapper.get('.hover-start').trigger('click');
    await wrapper.get('.hover-end').trigger('click');

    const startEvents = wrapper.emitted('hover-selection-start');
    expect(startEvents).toHaveLength(1);
    expect(startEvents?.[0]?.[0]).toMatchObject({ id: 'elem-1', type: 'element' });
    expect(wrapper.emitted('hover-selection-end')).toHaveLength(1);
  });

  describe('Send to Claude', () => {
    const mountSidebar = (props: Record<string, unknown> = {}) =>
      shallowMount(CapturesSidebar, {
        props: {
          selections: [elementSelection] as any,
          expandedId: null,
          isConnected: true,
          sessions: [],
          scanning: false,
          connecting: false,
          isPicking: false,
          isCoolingDown: false,
          sendBlocker: null,
          ...props,
        },
      });

    it('sits under Pick Element and emits when clicked', async () => {
      const wrapper = mountSidebar();
      const buttons = wrapper.findAll('button').map((b) => b.text());
      expect(buttons.indexOf('Send to Claude')).toBe(buttons.indexOf('Pick Element') + 1);

      await wrapper.get('[data-testid="send-to-claude"]').trigger('click');
      expect(wrapper.emitted('send-to-claude')).toHaveLength(1);
    });

    it('is disabled with the reason as its tooltip', () => {
      const button = mountSidebar({ sendBlocker: 'Capture an element or region first.' }).get('[data-testid="send-to-claude"]');
      expect(button.attributes('disabled')).toBeDefined();
      expect(button.attributes('title')).toBe('Capture an element or region first.');
    });

    it('shows progress while the message is sending', () => {
      const button = mountSidebar({ sending: true }).get('[data-testid="send-to-claude"]');
      expect(button.text()).toBe('Sending…');
      expect(button.attributes('disabled')).toBeDefined();
    });
  });
});
