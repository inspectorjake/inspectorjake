<script setup lang="ts">
/**
 * StateController - Floating toolbar for preview mode.
 * Dispatches mock Chrome messages to simulate different UI states.
 */
import { ref } from 'vue'
import { dispatchMessage, mockState } from './mock-chrome'
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
      class="absolute -top-8 right-0 px-2 py-1 bg-obsidian-800 text-gray-400 border border-obsidian-600 rounded-t text-[10px] hover:text-white"
      @click="collapsed = !collapsed"
    >
      {{ collapsed ? 'Show Controls' : 'Hide' }}
    </button>

    <!-- Control panel -->
    <div
      v-show="!collapsed"
      class="bg-obsidian-800 border border-obsidian-600 rounded-lg p-3 shadow-2xl min-w-[200px]"
    >
      <div class="text-[10px] text-gray-500 uppercase tracking-wider mb-2 font-bold">
        Preview Controls
      </div>

      <div class="space-y-1.5">
        <!-- Status -->
        <div class="flex items-center gap-2 mb-2 px-1">
          <span class="w-2 h-2 rounded-full" :class="mockState.connected ? 'bg-lime-accent' : 'bg-gray-500'" />
          <span class="text-gray-400">{{ mockState.connected ? `Connected: ${mockState.sessionName}` : 'Disconnected' }}</span>
        </div>

        <!-- Add element capture -->
        <button
          class="w-full px-3 py-1.5 bg-lime-accent/10 text-lime-accent border border-lime-accent/20 rounded hover:bg-lime-accent/20 transition-colors text-left"
          @click="addMockElement"
        >
          + Add Element Capture
        </button>

        <!-- Add screenshot capture -->
        <button
          class="w-full px-3 py-1.5 bg-purple-400/10 text-purple-400 border border-purple-400/20 rounded hover:bg-purple-400/20 transition-colors text-left"
          @click="addMockScreenshot"
        >
          + Add Screenshot
        </button>

        <!-- Simulate disconnect -->
        <button
          class="w-full px-3 py-1.5 bg-red-400/10 text-red-400 border border-red-400/20 rounded hover:bg-red-400/20 transition-colors text-left"
          @click="simulateDisconnect"
        >
          Simulate Disconnect
        </button>

        <!-- Cancel picker -->
        <button
          class="w-full px-3 py-1.5 bg-amber-400/10 text-amber-400 border border-amber-400/20 rounded hover:bg-amber-400/20 transition-colors text-left"
          @click="simulatePickerCancel"
        >
          Cancel Picker
        </button>
      </div>
    </div>
  </div>
</template>
