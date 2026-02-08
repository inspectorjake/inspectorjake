import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { shallowMount } from '@vue/test-utils';
import Panel from '../Panel.vue';

const mocks = vi.hoisted(() => ({
  isPicking: { value: false, __v_isRef: true },
  stopElementPicker: vi.fn(),
  startElementPicker: vi.fn(async () => {}),
  addLog: vi.fn(),
  scanForSessions: vi.fn(async () => {}),
  getConnectionStatus: vi.fn(async () => {}),
  connectToSession: vi.fn(async () => true),
  syncSelectionsToBackground: vi.fn(async () => {}),
  stopStatusPolling: vi.fn(),
  toggleLogs: vi.fn(),
  clearLogs: vi.fn(),
}));

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
    template: '<div />',
  },
  WorkspaceLayout: { template: '<div />' },
  SettingsDropdown: { template: '<div />' },
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
    clearAllSelections: vi.fn(),
    syncSelectionsToBackground: mocks.syncSelectionsToBackground,
  }),
  useConnection: () => ({
    sessions: ref([]),
    scanning: ref(false),
    connecting: ref(false),
    connectionStatus: ref({ connected: false }),
    error: ref<string | null>(null),
    isConnected: ref(false),
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

    vi.stubGlobal('chrome', {
      runtime: {
        onMessage: {
          addListener: vi.fn(),
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
});
