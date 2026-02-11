import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import SelectorBreadcrumb from '../SelectorBreadcrumb.vue';

describe('SelectorBreadcrumb', () => {
  it('normalizes leading slash noise in selector path', () => {
    const wrapper = mount(SelectorBreadcrumb, {
      props: {
        selector: ' / / #inputText',
        tagName: 'textarea',
      },
    });

    expect(wrapper.text()).toContain('Workspace');
    expect(wrapper.text()).toContain('#inputText');
    expect(wrapper.text()).not.toContain('/ /');
  });

  it('hides copy control when selector is empty after normalization', () => {
    const wrapper = mount(SelectorBreadcrumb, {
      props: {
        selector: ' / ',
        tagName: 'div',
      },
    });

    expect(wrapper.text()).toBe('Workspace');
    expect(wrapper.find('button').exists()).toBe(false);
  });
});
