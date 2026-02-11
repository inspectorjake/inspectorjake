import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import CaptureCard from '../CaptureCard.vue';

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

describe('CaptureCard', () => {
  it('emits hover lifecycle events', async () => {
    const wrapper = mount(CaptureCard, {
      props: {
        selection: elementSelection as any,
        isActive: false,
        index: 1,
      },
    });

    await wrapper.get('.group').trigger('mouseenter');
    await wrapper.get('.group').trigger('mouseleave');

    expect(wrapper.emitted('hover-start')).toHaveLength(1);
    expect(wrapper.emitted('hover-end')).toHaveLength(1);
  });
});
