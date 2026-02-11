import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { ComputedStylesMode } from '@inspector-jake/shared';
import InspectorPanel from '../InspectorPanel.vue';

describe('InspectorPanel', () => {
  it('renders Send Styles label and includes None mode', () => {
    const wrapper = mount(InspectorPanel, {
      props: {
        computedStylesMode: ComputedStylesMode.LEAN,
        computedStyles: { display: 'block' },
      },
    });

    expect(wrapper.text()).toContain('Send Styles:');
    expect(wrapper.text()).toContain('None');
    expect(wrapper.text()).toContain('Lean');
    expect(wrapper.text()).toContain('Non-Default');
    expect(wrapper.text()).toContain('All');
  });
});
