<script setup lang="ts">
/**
 * StateController - Floating toolbar for preview mode.
 * Dispatches mock Chrome messages to simulate different UI states.
 */
import { ref } from 'vue'
import {
  dispatchMessage,
  mockState,
  simulateChatReply,
  simulateChatHeld,
  toggleChatAvailable,
} from './mock-chrome'
import {
  MOCK_ELEMENT_NAV,
  MOCK_ELEMENT_BUTTON,
  MOCK_ELEMENT_HERO,
  generateMockScreenshot,
} from './mock-data'

const collapsed = ref(false)
const elementIndex = ref(0)

const MOCK_ELEMENTS = [MOCK_ELEMENT_NAV, MOCK_ELEMENT_BUTTON, MOCK_ELEMENT_HERO]

function addMockElement(): void {
  const el = MOCK_ELEMENTS[elementIndex.value % MOCK_ELEMENTS.length]
  elementIndex.value++

  dispatchMessage({
    type: 'ELEMENT_PICKED',
    element: { ...el },
  })
}

function addMockScreenshot(): void {
  const rect = { x: 50, y: 100, width: 320, height: 180 }
  dispatchMessage({
    type: 'SCREENSHOT_REGION_SELECTED',
    rect,
    image: generateMockScreenshot(rect.width, rect.height),
  })
}

function simulateDisconnect(): void {
  mockState.connected = false
  mockState.sessionName = null
  dispatchMessage({ type: 'CONNECTION_CLOSED' })
}

function simulatePickerCancel(): void {
  dispatchMessage({ type: 'PICKER_CANCELLED' })
}
</script>

<template>
  <div class="fixed bottom-4 right-4 z-[9999] font-sans text-xs">
    <!-- Toggle button -->
    <button
      class="absolute -top-8 right-0 px-2 py-1 bg-ios-elevated text-ios-label-secondary border border-ios-separator rounded-t text-[10px] hover:text-white"
      @click="collapsed = !collapsed"
    >
      {{ collapsed ? 'Show Controls' : 'Hide' }}
    </button>

    <!-- Control panel -->
    <div
      v-show="!collapsed"
      class="bg-ios-elevated border border-ios-separator rounded-lg p-3 shadow-2xl min-w-[200px]"
    >
      <div class="text-[10px] text-ios-label-secondary uppercase tracking-wider mb-2 font-bold">
        Preview Controls
      </div>

      <div class="space-y-1.5">
        <!-- Status -->
        <div class="flex items-center gap-2 mb-2 px-1">
          <span class="w-2 h-2 rounded-full" :class="mockState.connected ? 'bg-ios-green' : 'bg-ios-label-tertiary'" />
          <span class="text-ios-label-secondary">{{ mockState.connected ? `Connected: ${mockState.sessionName}` : 'Disconnected' }}</span>
        </div>

        <!-- Add element capture -->
        <button
          class="w-full px-3 py-1.5 bg-ios-green/10 text-ios-green border border-ios-green/20 rounded hover:bg-ios-green/20 transition-colors text-left"
          @click="addMockElement"
        >
          + Add Element Capture
        </button>

        <!-- Add screenshot capture -->
        <button
          class="w-full px-3 py-1.5 bg-ios-purple/10 text-ios-purple border border-ios-purple/20 rounded hover:bg-ios-purple/20 transition-colors text-left"
          @click="addMockScreenshot"
        >
          + Add Screenshot
        </button>

        <!-- Simulate disconnect -->
        <button
          class="w-full px-3 py-1.5 bg-ios-red/10 text-ios-red border border-ios-red/20 rounded hover:bg-ios-red/20 transition-colors text-left"
          @click="simulateDisconnect"
        >
          Simulate Disconnect
        </button>

        <!-- Chat -->
        <button
          class="w-full px-3 py-1.5 bg-ios-purple/10 text-ios-purple border border-ios-purple/20 rounded hover:bg-ios-purple/20 transition-colors text-left"
          @click="simulateChatReply()"
        >
          Simulate Claude Reply
        </button>
        <button
          class="w-full px-3 py-1.5 bg-ios-orange/10 text-ios-orange border border-ios-orange/20 rounded hover:bg-ios-orange/20 transition-colors text-left"
          @click="simulateChatHeld"
        >
          Simulate Held Message
        </button>
        <button
          class="w-full px-3 py-1.5 bg-ios-label-secondary/10 text-ios-label border border-ios-label-secondary/20 rounded hover:bg-ios-label-secondary/20 transition-colors text-left"
          @click="toggleChatAvailable"
        >
          Toggle Chat Availability
        </button>

        <!-- Cancel picker -->
        <button
          class="w-full px-3 py-1.5 bg-ios-orange/10 text-ios-orange border border-ios-orange/20 rounded hover:bg-ios-orange/20 transition-colors text-left"
          @click="simulatePickerCancel"
        >
          Cancel Picker
        </button>
      </div>
    </div>
  </div>
</template>
