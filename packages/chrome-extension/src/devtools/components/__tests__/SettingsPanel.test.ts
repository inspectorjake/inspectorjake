// Tests for the redesigned SettingsPanel slide-out component.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref, type Ref } from 'vue';
import { mount } from '@vue/test-utils';
import SettingsPanel from '../SettingsPanel.vue';

const setComputedStylesMode = vi.fn(async () => true);

let computedStylesMode: Ref<string>;
let maxScreenshotDimension: Ref<number>;
let autoClearSelectionsAfterSeen: Ref<boolean>;

vi.mock('../../composables/index.js', () => ({
  useSettings: () => ({
    computedStylesMode,
    maxScreenshotDimension,
    autoClearSelectionsAfterSeen,
    setComputedStylesMode,
  }),
}));

describe('SettingsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    computedStylesMode = ref('lean');
    maxScreenshotDimension = ref(800);
    autoClearSelectionsAfterSeen = ref(true);
  });

  it('renders panel content when open is true', () => {
    const wrapper = mount(SettingsPanel, {
      props: { open: true },
    });

    expect(wrapper.text()).toContain('Configuration');
    expect(wrapper.text()).toContain('Computed Styles');
    expect(wrapper.text()).toContain('Screenshot Capture');
  });

  it('renders nothing when open is false', () => {
    const wrapper = mount(SettingsPanel, {
      props: { open: false },
    });

    expect(wrapper.text()).toBe('');
  });

  it('emits close when X button is clicked', async () => {
    const wrapper = mount(SettingsPanel, {
      props: { open: true },
    });

    const closeButton = wrapper.find('[title="Close settings"]');
    await closeButton.trigger('click');

    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('emits close on Escape key', async () => {
    const wrapper = mount(SettingsPanel, {
      props: { open: true },
    });

    const panel = wrapper.find('[data-testid="settings-panel"]');
    await panel.trigger('keydown', { key: 'Escape' });

    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('emits close when backdrop is clicked', async () => {
    const wrapper = mount(SettingsPanel, {
      props: { open: true },
    });

    const backdrop = wrapper.find('[data-testid="settings-backdrop"]');
    await backdrop.trigger('click');

    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('calls setComputedStylesMode and emits mode-changed when style mode is selected', async () => {
    const wrapper = mount(SettingsPanel, {
      props: { open: true },
    });

    // Click the "ALL" mode button (third radio option)
    const modeButtons = wrapper.findAll('[data-testid^="mode-"]');
    const allButton = modeButtons.find(b => b.attributes('data-testid') === 'mode-all');
    expect(allButton).toBeTruthy();
    await allButton!.trigger('click');

    expect(setComputedStylesMode).toHaveBeenCalledWith('all');
    expect(wrapper.emitted('mode-changed')).toHaveLength(1);
  });

  it('supports selecting NONE styles mode', async () => {
    const wrapper = mount(SettingsPanel, {
      props: { open: true },
    });

    const noneButton = wrapper.find('[data-testid="mode-none"]');
    expect(noneButton.exists()).toBe(true);

    await noneButton.trigger('click');

    expect(setComputedStylesMode).toHaveBeenCalledWith('none');
    expect(wrapper.emitted('mode-changed')).toHaveLength(1);
  });

  it('updates screenshot dimension via number input', async () => {
    const wrapper = mount(SettingsPanel, {
      props: { open: true },
    });

    const input = wrapper.find('input[type="number"]');
    await input.setValue('1200');

    expect(maxScreenshotDimension.value).toBe(1200);
  });

  it('clamps screenshot dimension to max 2000', async () => {
    const wrapper = mount(SettingsPanel, {
      props: { open: true },
    });

    const input = wrapper.find('input[type="number"]');
    await input.setValue('9999');

    expect(maxScreenshotDimension.value).toBe(2000);
  });

  it('clamps screenshot dimension to min 200', async () => {
    const wrapper = mount(SettingsPanel, {
      props: { open: true },
    });

    const input = wrapper.find('input[type="number"]');
    await input.setValue('50');

    expect(maxScreenshotDimension.value).toBe(200);
  });

  it('updates auto-clear setting via checkbox', async () => {
    const wrapper = mount(SettingsPanel, {
      props: { open: true },
    });

    const checkbox = wrapper.find('[data-testid="auto-clear-selections"]');
    expect(checkbox.exists()).toBe(true);
    expect(autoClearSelectionsAfterSeen.value).toBe(true);

    await checkbox.setValue(false);

    expect(autoClearSelectionsAfterSeen.value).toBe(false);
  });

});
