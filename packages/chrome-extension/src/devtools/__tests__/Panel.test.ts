import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { shallowMount } from '@vue/test-utils';
import Panel from '../Panel.vue';

const mocks = vi.hoisted(() => ({
  isPicking: { value: false, __v_isRef: true },
  isConnected: { value: false, __v_isRef: true },
  stopElementPicker: vi.fn(),
  startElementPicker: vi.fn(async () => {}),
  highlightSelector: vi.fn(async () => {}),
  clearHighlight: vi.fn(),
  addLog: vi.fn(),
  scanForSessions: vi.fn(async () => {}),
  getConnectionStatus: vi.fn(async () => {}),
  connectToSession: vi.fn(async () => true),
  syncSelectionsToBackground: vi.fn(async () => {}),
  refreshExpandedStyles: vi.fn(async () => {}),
  clearAllSelections: vi.fn(),
  setComputedStylesMode: vi.fn(async () => true),
  stopStatusPolling: vi.fn(),
  toggleLogs: vi.fn(),
  clearLogs: vi.fn(),
}));

let runtimeListener: ((message: { type: string; [key: string]: unknown }) => unknown) | null = null;

const panelStubs = {
  ViewToggleBar: { template: '<div />' },
  AppHeader: {
    props: [
      'isConnected',
      'sessionName',
      'connecting',
      'isPicking',
      'isCoolingDown',
      'showLogs',
      'hasLogErrors',
      'showSettings',
    ],
    template: '<div />',
  },
  CapturesSidebar: {
    props: [
      'selections',
      'expandedId',
      'isConnected',
      'sessions',
      'scanning',
      'connecting',
      'isPicking',
      'isCoolingDown',
    ],
    emits: ['hover-selection-start', 'hover-selection-end'],
    template: `
      <div>
        <button
          class="hover-start-element"
          @click="$emit('hover-selection-start', { type: 'element', selector: 'main > button' })"
        />
        <button
          class="hover-start-screenshot"
          @click="$emit('hover-selection-start', { type: 'screenshot' })"
        />
        <button class="hover-end" @click="$emit('hover-selection-end')" />
      </div>
    `,
  },
  WorkspaceLayout: {
    emits: ['update:computedStylesMode'],
    template: '<button class="mode-update" @click="$emit(\'update:computedStylesMode\', \'all\')">mode</button>',
  },
  SettingsPanel: { template: '<div />' },
};

vi.mock('../composables/index.js', () => ({
  useSelections: () => ({
    selections: ref([]),
    expandedId: ref<string | null>(null),
    expandedSelection: ref(null),
    toggleExpanded: vi.fn(),
    addElementSelection: vi.fn(async () => {}),
    addScreenshotSelection: vi.fn(),
    removeSelection: vi.fn(),
    updateSelectionNote: vi.fn(),
    refreshExpandedStyles: mocks.refreshExpandedStyles,
    clearAllSelections: mocks.clearAllSelections,
    syncSelectionsToBackground: mocks.syncSelectionsToBackground,
  }),
  useConnection: () => ({
    sessions: ref([]),
    scanning: ref(false),
    connecting: ref(false),
    connectionStatus: ref({ connected: false }),
    error: ref<string | null>(null),
    isConnected: mocks.isConnected,
    connectedSessionName: ref<string | null>(null),
    scanForSessions: mocks.scanForSessions,
    getConnectionStatus: mocks.getConnectionStatus,
    connectToSession: mocks.connectToSession,
    disconnect: vi.fn(),
    handleConnectionClosed: vi.fn(),
    stopStatusPolling: mocks.stopStatusPolling,
  }),
  usePicker: () => ({
    isPicking: mocks.isPicking,
    error: ref<string | null>(null),
    isCoolingDown: ref(false),
    startElementPicker: mocks.startElementPicker,
    stopElementPicker: mocks.stopElementPicker,
    highlightSelector: mocks.highlightSelector,
    clearHighlight: mocks.clearHighlight,
    captureElementScreenshot: vi.fn(async () => null),
    cancelPicking: vi.fn(),
  }),
  useLogs: () => ({
    logs: ref([]),
    showLogs: ref(false),
    addLog: mocks.addLog,
    clearLogs: mocks.clearLogs,
    toggleLogs: mocks.toggleLogs,
  }),
  useSettings: () => ({
    computedStylesMode: ref('non-default'),
    maxScreenshotDimension: ref(2000),
    autoClearSelectionsAfterSeen: ref(true),
    setComputedStylesMode: mocks.setComputedStylesMode,
  }),
  LogLevel: {
    INFO: 'INFO',
    SUCCESS: 'SUCCESS',
    ERROR: 'ERROR',
  },
  LogSource: {
    EXT: 'EXT',
  },
}));

describe('Panel picker cancellation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isPicking.value = false;
    mocks.isConnected.value = false;
    runtimeListener = null;

    vi.stubGlobal('chrome', {
      runtime: {
        onMessage: {
          addListener: vi.fn((listener: (message: { type: string; [key: string]: unknown }) => unknown) => {
            runtimeListener = listener;
          }),
          removeListener: vi.fn(),
        },
      },
    });
  });

  it('deactivates picker on panel click when picker is active', async () => {
    mocks.isPicking.value = true;

    const wrapper = shallowMount(Panel, {
      global: {
        stubs: panelStubs,
      },
    });

    await wrapper.get('div.h-full').trigger('click');

    expect(mocks.stopElementPicker).toHaveBeenCalledTimes(1);
  });

  it('does not deactivate picker on panel click when picker is inactive', async () => {
    const wrapper = shallowMount(Panel, {
      global: {
        stubs: panelStubs,
      },
    });

    await wrapper.get('div.h-full').trigger('click');

    expect(mocks.stopElementPicker).not.toHaveBeenCalled();
  });

  it('applies mode before refreshing expanded styles', async () => {
    mocks.isConnected.value = true;

    const wrapper = shallowMount(Panel, {
      global: {
        stubs: panelStubs,
      },
    });

    await wrapper.get('.mode-update').trigger('click');

    expect(mocks.setComputedStylesMode).toHaveBeenCalledWith('all');
    expect(mocks.refreshExpandedStyles).toHaveBeenCalledTimes(1);
    expect(mocks.setComputedStylesMode.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.refreshExpandedStyles.mock.invocationCallOrder[0]);
  });

  it('clears selections when auto-clear message is received', async () => {
    shallowMount(Panel, {
      global: {
        stubs: panelStubs,
      },
    });

    expect(runtimeListener).toBeTruthy();
    await runtimeListener?.({ type: 'SELECTIONS_AUTO_CLEARED' });

    expect(mocks.clearAllSelections).toHaveBeenCalledTimes(1);
  });

  it('highlights element selection on capture hover start', async () => {
    const wrapper = shallowMount(Panel, {
      global: {
        stubs: panelStubs,
      },
    });

    await wrapper.get('.hover-start-element').trigger('click');

    expect(mocks.highlightSelector).toHaveBeenCalledWith('main > button', undefined);
    expect(mocks.clearHighlight).not.toHaveBeenCalled();
  });

  it('clears highlight for screenshot hover and on hover end', async () => {
    const wrapper = shallowMount(Panel, {
      global: {
        stubs: panelStubs,
      },
    });

    await wrapper.get('.hover-start-screenshot').trigger('click');
    await wrapper.get('.hover-end').trigger('click');

    expect(mocks.highlightSelector).not.toHaveBeenCalled();
    expect(mocks.clearHighlight).toHaveBeenCalledTimes(2);
  });

  it('clears highlight on unmount', () => {
    const wrapper = shallowMount(Panel, {
      global: {
        stubs: panelStubs,
      },
    });

    wrapper.unmount();

    expect(mocks.clearHighlight).toHaveBeenCalledTimes(1);
  });
});
