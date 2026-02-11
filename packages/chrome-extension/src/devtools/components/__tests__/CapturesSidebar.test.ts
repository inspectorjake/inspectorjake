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
});
