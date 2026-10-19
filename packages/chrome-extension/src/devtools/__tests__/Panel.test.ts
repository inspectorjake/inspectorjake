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
  chatSend: vi.fn(async () => true),
  chatRefresh: vi.fn(async () => {}),
  chatReset: vi.fn(),
  chatMarkRead: vi.fn(),
  chatHandleEntry: vi.fn(),
  chatHandleBridgeInfo: vi.fn(),
}));

let runtimeListener: ((message: { type: string; [key: string]: unknown }) => unknown) | null = null;

const panelStubs = {
  ViewToggleBar: {
    props: ['modelValue', 'chatUnread'],
    emits: ['update:modelValue'],
    template: '<button class="view-chat" @click="$emit(\'update:modelValue\', \'chat\')" />',
  },
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
  ChatPanel: {
    props: ['messages', 'bridgeInfo', 'draft', 'sending', 'error', 'captureCount', 'noteCount'],
    emits: ['send', 'update:draft'],
    template: `
      <div class="chat-panel-stub">
        <button class="chat-type" @click="$emit('update:draft', 'what is this?')" />
        <button class="chat-send" @click="$emit('send')" />
        <span class="chat-draft">{{ draft }}</span>
      </div>
    `,
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
  useChat: () => ({
    messages: ref([]),
    bridgeInfo: ref(null),
    sending: ref(false),
    error: ref<string | null>(null),
    unread: ref(0),
    refresh: mocks.chatRefresh,
    send: mocks.chatSend,
    handleEntry: mocks.chatHandleEntry,
    handleBridgeInfo: mocks.chatHandleBridgeInfo,
    markRead: mocks.chatMarkRead,
    reset: mocks.chatReset,
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

describe('Panel chat view', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isPicking.value = false;
    mocks.isConnected.value = true;
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

  const mountPanel = () => shallowMount(Panel, { global: { stubs: panelStubs } });

  it('shows the workspace by default and the chat after switching views', async () => {
    const wrapper = mountPanel();
    expect(wrapper.find('.mode-update').exists()).toBe(true);
    expect(wrapper.find('.chat-panel-stub').exists()).toBe(false);

    await wrapper.get('.view-chat').trigger('click');

    expect(wrapper.find('.mode-update').exists()).toBe(false);
    expect(wrapper.find('.chat-panel-stub').exists()).toBe(true);
    expect(mocks.chatMarkRead).toHaveBeenCalled();
  });

  it('sends the draft and clears it once sent', async () => {
    const wrapper = mountPanel();
    await wrapper.get('.view-chat').trigger('click');
    await wrapper.get('.chat-type').trigger('click');
    expect(wrapper.get('.chat-draft').text()).toBe('what is this?');

    await wrapper.get('.chat-send').trigger('click');
    await new Promise((r) => setTimeout(r, 0));

    expect(mocks.chatSend).toHaveBeenCalledWith('what is this?');
    expect(wrapper.get('.chat-draft').text()).toBe('');
  });

  it('keeps the draft when sending fails', async () => {
    mocks.chatSend.mockResolvedValueOnce(false);
    const wrapper = mountPanel();
    await wrapper.get('.view-chat').trigger('click');
    await wrapper.get('.chat-type').trigger('click');
    await wrapper.get('.chat-send').trigger('click');
    await new Promise((r) => setTimeout(r, 0));

    expect(wrapper.get('.chat-draft').text()).toBe('what is this?');
  });

  it('routes chat entries, counting them as unread unless the chat is open', async () => {
    const wrapper = mountPanel();
    const entry = { id: 'e1', role: 'claude', text: 'hi', ts: 1 };

    await runtimeListener?.({ type: 'CHAT_ENTRY', sessionName: 'jake', entry });
    expect(mocks.chatHandleEntry).toHaveBeenLastCalledWith({ sessionName: 'jake', entry }, false);

    await wrapper.get('.view-chat').trigger('click');
    await runtimeListener?.({ type: 'CHAT_ENTRY', sessionName: 'jake', entry });
    expect(mocks.chatHandleEntry).toHaveBeenLastCalledWith({ sessionName: 'jake', entry }, true);
  });

  it('routes chat bridge info', async () => {
    mountPanel();
    const bridgeInfo = { available: true, name: 'jake-panel' };
    await runtimeListener?.({ type: 'CHAT_BRIDGE_INFO', sessionName: 'jake', bridgeInfo });
    expect(mocks.chatHandleBridgeInfo).toHaveBeenCalledWith({ bridgeInfo });
  });
});
