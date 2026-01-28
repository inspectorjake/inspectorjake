<script setup lang="ts">
/**
 * Jake MCP DevTools Panel - Main Vue component.
 * Refactored to use composables for state management.
 */

import { onMounted, onUnmounted } from 'vue';
import type { ElementInfo } from '@inspector-jake/shared';
import { useSelections, useConnection, usePicker, type DiscoveredSession } from './composables/index.js';

// Initialize composables
const {
  selections,
  expandedId,
  expandedSelection,
  toggleExpanded,
  addElementSelection,
  addScreenshotSelection,
  removeSelection,
  clearAllSelections,
  syncSelectionsToBackground,
} = useSelections();

const {
  sessions,
  scanning,
  connecting,
  connectionStatus,
  error: connectionError,
  isConnected,
  connectedSessionName,
  scanForSessions,
  getConnectionStatus,
  connectToSession: connectToSessionBase,
  disconnect,
  handleConnectionClosed,
} = useConnection();

const {
  isPicking,
  error: pickerError,
  startElementPicker,
  stopElementPicker,
  highlightSelector,
  clearHighlight,
  captureElementScreenshot,
  cancelPicking,
} = usePicker();

// Unified error from both composables
import { computed } from 'vue';
const error = computed(() => connectionError.value || pickerError.value);

/**
 * Connect to a session and sync selections.
 */
async function connectToSession(session: DiscoveredSession) {
  const success = await connectToSessionBase(session);
  if (success) {
    // Sync existing selections to background so MCP server is aware
    await syncSelectionsToBackground();
  }
}

/**
 * Handle incoming messages from background/content scripts.
 */
async function handleMessage(message: any) {
  if (message.type === 'CONNECTION_CLOSED') {
    handleConnectionClosed();
  }

  // Handle element selection updates from devtools.ts (Elements panel)
  if (message.type === 'DEVTOOLS_ELEMENT_SELECTED') {
    await addElementSelection(message.element as ElementInfo, captureElementScreenshot);
  }

  // Handle element picked from custom picker (click, not drag)
  if (message.type === 'ELEMENT_PICKED') {
    cancelPicking();
    await addElementSelection(message.element as ElementInfo, captureElementScreenshot);
  }

  // Handle screenshot region selected (drag)
  if (message.type === 'SCREENSHOT_REGION_SELECTED') {
    cancelPicking();
    const { rect } = message;
    const image = await captureElementScreenshot(rect);
    if (image) {
      addScreenshotSelection(rect, image);
    }
  }

  // Handle picker cancelled (Escape pressed)
  if (message.type === 'PICKER_CANCELLED') {
    cancelPicking();
  }

  // Legacy: Handle region selection completed (from old region selector)
  if (message.type === 'REGION_SELECTED') {
    const { image, rect } = message;
    if (image) {
      addScreenshotSelection(rect, image);
    }
  }

  // Legacy: Handle region selection cancelled
  if (message.type === 'REGION_CANCELLED') {
    cancelPicking();
  }
}

/**
 * Format element for display.
 */
function formatElementDisplay(el: { tagName: string; id?: string | null }): string {
  let display = `<${el.tagName}`;
  if (el.id) display += `#${el.id}`;
  display += '>';
  return display;
}

onMounted(async () => {
  chrome.runtime.onMessage.addListener(handleMessage);
  await Promise.all([
    getConnectionStatus(),
    scanForSessions(),
  ]);

  // Auto-connect to first available session if not already connected
  if (!connectionStatus.value.connected && sessions.value.length > 0) {
    const availableSession = sessions.value.find(s => s.status !== 'connected');
    if (availableSession) {
      await connectToSession(availableSession);
    }
  }
});

onUnmounted(() => {
  chrome.runtime.onMessage.removeListener(handleMessage);
  // Stop picker if active when panel closes
  if (isPicking.value) {
    stopElementPicker();
  }
});
</script>

<template>
  <div class="panel">
    <!-- Header -->
    <header class="header">
      <div class="logo">
        <svg
          class="picker-icon"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          @click="isPicking ? stopElementPicker() : startElementPicker()"
          :class="{ active: isPicking }"
          :title="isPicking ? 'Stop picking (Esc)' : 'Select element or drag region'"
        >
          <circle cx="10" cy="10" r="7"/>
          <path d="m21 21-5.2-5.2"/>
          <path d="M10 7v6"/>
          <path d="M7 10h6"/>
        </svg>
        <img
          class="logo-icon"
          src="/icons/logo.svg"
          alt="Jake MCP"
          width="24"
          height="24"
        />
        <h1 class="title">Jake MCP</h1>
      </div>
    </header>

    <!-- Connection Status Card -->
    <section class="section">
      <h2 class="section-title">CONNECTION</h2>
      <div v-if="isConnected" class="card connected">
        <div class="card-row">
          <div class="status-indicator">
            <svg width="12" height="12" viewBox="0 0 12 12">
              <circle cx="6" cy="6" r="5" fill="#22C55E"/>
            </svg>
          </div>
          <div class="status-content">
            <div class="status-label">Connected to: {{ connectedSessionName }}</div>
          </div>
          <button class="btn btn-danger" @click="disconnect">
            Disconnect
          </button>
        </div>
      </div>
      <div v-else class="card">
        <div class="card-row">
          <div class="status-indicator">
            <svg width="12" height="12" viewBox="0 0 12 12">
              <circle cx="6" cy="6" r="4.5" fill="none" stroke="#64748B" stroke-width="1.5"/>
            </svg>
          </div>
          <div class="status-content">
            <div class="status-label">Not Connected</div>
          </div>
        </div>
      </div>
    </section>

    <!-- Error Message -->
    <div v-if="error" class="error-card">
      <svg class="error-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <span>{{ error }}</span>
    </div>

    <!-- Sessions Section (shown when not connected) -->
    <section class="section" v-if="!isConnected">
      <div class="section-header">
        <h2 class="section-title">AVAILABLE CONNECTIONS</h2>
        <button
          class="btn btn-icon"
          @click="scanForSessions"
          :disabled="scanning"
        >
          <svg
            :class="['refresh-icon', { spinning: scanning }]"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
            <path d="M3 3v5h5"/>
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
            <path d="M16 16h5v5"/>
          </svg>
        </button>
      </div>

      <!-- Loading State -->
      <div v-if="scanning" class="loading-state">
        <svg class="spinner" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
        <span>Scanning...</span>
      </div>

      <!-- Empty State -->
      <div v-else-if="sessions.length === 0" class="empty-state">
        <p>No MCP servers found.</p>
        <p class="empty-hint">Start one with:</p>
        <code class="code-block">npx vibe-jake-mcp</code>
      </div>

      <!-- Session List -->
      <ul v-else class="session-list">
        <li
          v-for="session in sessions"
          :key="session.name"
          class="session-item"
          :class="{ 'session-disabled': connecting || session.status === 'connected' }"
          @click="!(connecting || session.status === 'connected') && connectToSession(session)"
        >
          <div class="session-info">
            <div class="session-name">
              <svg width="8" height="8" viewBox="0 0 8 8">
                <circle cx="4" cy="4" r="4" :fill="session.status === 'connected' ? '#F59E0B' : '#22C55E'"/>
              </svg>
              <span>{{ session.name }}</span>
            </div>
            <div class="session-port">Port {{ session.port }}</div>
          </div>
          <button
            class="btn"
            :class="session.status === 'connected' ? 'btn-warning' : 'btn-primary'"
            @click.stop="connectToSession(session)"
            :disabled="connecting || session.status === 'connected'"
          >
            {{ session.status === 'connected' ? 'In Use' : 'Connect' }}
          </button>
        </li>
      </ul>
    </section>

    <!-- Connected UI: Unified Selections -->
    <template v-if="isConnected">
      <!-- Selections Section -->
      <section class="section">
        <div class="section-header">
          <h2 class="section-title">SELECTIONS</h2>
          <button
            v-if="selections.length > 0"
            class="btn btn-icon"
            @click="clearAllSelections"
            title="Clear all selections"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18"/>
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
            </svg>
          </button>
        </div>

        <!-- Selection Grid (with add button) -->
        <div v-if="selections.length > 0" class="selection-grid">
          <div
            v-for="sel in selections"
            :key="sel.id"
            class="selection-item"
            :class="[sel.type, { selected: expandedId === sel.id }]"
            @click="toggleExpanded(sel.id)"
          >
            <img :src="sel.image" class="selection-thumb" :alt="`${sel.width}x${sel.height}`" />
            <span class="selection-badge">{{ sel.type === 'element' ? 'elem' : 'shot' }}</span>
            <button class="selection-remove" @click.stop="removeSelection(sel.id)" title="Remove">×</button>
          </div>
          <!-- Add selection button in grid -->
          <button
            class="selection-add"
            :class="{ active: isPicking }"
            @click="isPicking ? stopElementPicker() : startElementPicker()"
            :title="isPicking ? 'Cancel (Esc)' : 'Add selection'"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 5v14"/>
              <path d="M5 12h14"/>
            </svg>
          </button>
        </div>

        <!-- Expanded detail panel (shown below grid when selection clicked) -->
        <div v-if="expandedSelection" class="selection-detail">
          <img :src="expandedSelection.image" class="detail-image" :alt="`${expandedSelection.width}x${expandedSelection.height}`" />
          <div class="detail-info">
            <template v-if="expandedSelection.type === 'element'">
              <div class="detail-tag">{{ formatElementDisplay(expandedSelection) }}</div>
              <div class="detail-row">
                <span class="detail-label">selector</span>
                <code
                  class="detail-selector"
                  @mouseenter="highlightSelector(expandedSelection.selector)"
                  @mouseleave="clearHighlight()"
                >{{ expandedSelection.selector }}</code>
              </div>
              <div v-if="expandedSelection.className" class="detail-row">
                <span class="detail-label">class</span>
                <span class="detail-value">{{ expandedSelection.className }}</span>
              </div>
            </template>
            <template v-else>
              <div class="detail-tag screenshot-tag">Screenshot Region</div>
            </template>
            <div class="detail-row">
              <span class="detail-label">size</span>
              <span class="detail-value">{{ expandedSelection.width }} × {{ expandedSelection.height }}</span>
            </div>
          </div>
        </div>

        <!-- Empty state: Add a Selection placeholder -->
        <div
          v-else-if="selections.length === 0"
          class="selection-placeholder"
          :class="{ active: isPicking }"
          @click="isPicking ? stopElementPicker() : startElementPicker()"
        >
          <svg class="selection-placeholder-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.3-4.3"/>
            <path d="M11 8v6"/>
            <path d="M8 11h6"/>
          </svg>
          <span class="selection-placeholder-text">{{ isPicking ? 'Click element or drag region...' : 'Add a Selection' }}</span>
          <span class="selection-placeholder-hint">{{ isPicking ? 'Press Esc to cancel' : 'Click an element or drag to capture a region' }}</span>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
/* Color Variables */
.panel {
  --bg-primary: #0F172A;
  --bg-secondary: #1E293B;
  --bg-tertiary: #334155;
  --border-color: #475569;
  --text-primary: #F8FAFC;
  --text-secondary: #94A3B8;
  --text-muted: #64748B;
  --accent-green: #22C55E;
  --accent-green-hover: #16A34A;
  --accent-amber: #F59E0B;
  --accent-red: #EF4444;
  --accent-blue: #3B82F6;
  --accent-purple: #A855F7;
  --accent-cyan: #06B6D4;
}

.panel {
  height: 100%;
  padding: 16px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Header */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
}

.picker-icon {
  color: var(--text-muted);
  cursor: pointer;
  transition: all 150ms ease;
  padding: 4px;
  border-radius: 8px;
  border: 2px dashed var(--border-color);
  flex-shrink: 0;
}

.picker-icon:hover {
  color: var(--accent-green);
  background: var(--bg-tertiary);
  border-color: var(--accent-green);
  transform: scale(1.05);
}

.picker-icon.active {
  color: var(--accent-green);
  background: rgba(34, 197, 94, 0.15);
  border-color: var(--accent-green);
  border-style: solid;
  animation: pulse 1s ease-in-out infinite;
}

.logo-icon {
  width: 24px;
  height: 24px;
  border-radius: 4px;
}

.title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

/* Sections */
.section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-title {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Cards */
.card {
  padding: 12px;
  border-radius: 8px;
  background: var(--bg-secondary);
  border: 1px solid var(--bg-tertiary);
}

.card.connected {
  border-color: rgba(34, 197, 94, 0.3);
}

.card-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
}

.status-content {
  flex: 1;
}

.status-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 32px;
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 150ms ease;
}

.btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--bg-primary), 0 0 0 4px rgba(34, 197, 94, 0.5);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--accent-green);
  color: #0F172A;
}

.btn-primary:hover:not(:disabled) {
  background: var(--accent-green-hover);
}

.btn-warning {
  background: rgba(245, 158, 11, 0.15);
  color: var(--accent-amber);
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.btn-danger {
  background: rgba(239, 68, 68, 0.15);
  color: var(--accent-red);
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.btn-danger:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.25);
}

.btn-icon {
  width: 32px;
  height: 32px;
  padding: 0;
  background: transparent;
  color: var(--text-muted);
  border: none;
  border-radius: 6px;
}

.btn-icon:hover:not(:disabled) {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Error Card */
.error-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 6px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: #FCA5A5;
  font-size: 12px;
}

.error-icon {
  flex-shrink: 0;
  color: var(--accent-red);
}

/* Loading & Empty States */
.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 13px;
  background: var(--bg-secondary);
  border: 1px solid var(--bg-tertiary);
  border-radius: 8px;
}

.loading-state {
  flex-direction: row;
  gap: 10px;
}

.spinner {
  animation: spin 1s linear infinite;
  color: var(--accent-green);
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.refresh-icon {
  transition: transform 150ms ease;
}

.refresh-icon.spinning {
  animation: spin 1s linear infinite;
}

.empty-hint {
  margin-top: 4px;
  color: var(--text-muted);
  font-size: 12px;
}

.code-block {
  display: block;
  margin-top: 8px;
  padding: 10px 14px;
  background: var(--bg-tertiary);
  border-radius: 6px;
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 12px;
  color: var(--accent-green);
}

/* Session List */
.session-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.session-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--bg-tertiary);
  border-radius: 8px;
  cursor: pointer;
  transition: all 150ms ease;
}

.session-item:hover:not(.session-disabled) {
  background: var(--bg-tertiary);
  border-color: var(--border-color);
}

.session-item.session-disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.session-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.session-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.session-port {
  font-size: 11px;
  color: var(--text-muted);
  margin-left: 16px;
}

/* ============================================
   Unified Selections Grid & Detail Panel
   ============================================ */

.selection-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px;
  background: var(--bg-secondary);
  border-radius: 8px;
  border: 1px solid var(--bg-tertiary);
}

.selection-item {
  position: relative;
  width: 80px;
  height: 60px;
  border-radius: 6px;
  overflow: hidden;
  border: 2px solid var(--border-color);
  cursor: pointer;
  transition: all 150ms ease;
}

.selection-item:hover {
  border-color: var(--text-muted);
}

.selection-item.selected {
  border-color: var(--accent-green);
  box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.25);
}

/* Type-specific border colors */
.selection-item.element {
  border-color: var(--accent-purple);
}

.selection-item.element.selected {
  border-color: var(--accent-purple);
  box-shadow: 0 0 0 2px rgba(168, 85, 247, 0.25);
}

.selection-item.screenshot {
  border-color: var(--accent-cyan);
}

.selection-item.screenshot.selected {
  border-color: var(--accent-cyan);
  box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.25);
}

.selection-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.selection-badge {
  position: absolute;
  bottom: 2px;
  left: 2px;
  font-size: 8px;
  padding: 2px 4px;
  background: rgba(0, 0, 0, 0.8);
  color: var(--text-secondary);
  border-radius: 3px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
}

.selection-item.element .selection-badge {
  color: var(--accent-purple);
}

.selection-item.screenshot .selection-badge {
  color: var(--accent-cyan);
}

.selection-remove {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--accent-red);
  color: white;
  border: none;
  font-size: 14px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  opacity: 0;
  transition: opacity 150ms ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.selection-item:hover .selection-remove {
  opacity: 1;
}

.selection-remove:hover {
  background: #DC2626;
}

/* Add selection button in grid */
.selection-add {
  width: 80px;
  height: 60px;
  border-radius: 6px;
  border: 2px dashed var(--border-color);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 150ms ease;
}

.selection-add:hover {
  border-color: var(--accent-green);
  color: var(--accent-green);
  background: rgba(34, 197, 94, 0.05);
}

.selection-add.active {
  border-color: var(--accent-green);
  border-style: solid;
  color: var(--accent-green);
  background: rgba(34, 197, 94, 0.1);
  animation: pulse 1s ease-in-out infinite;
}

/* Expanded detail panel */
.selection-detail {
  display: flex;
  gap: 16px;
  padding: 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--bg-tertiary);
  border-radius: 8px;
  margin-top: 8px;
}

.detail-image {
  max-width: 200px;
  max-height: 150px;
  object-fit: contain;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: var(--bg-tertiary);
}

.detail-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.detail-tag {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 14px;
  font-weight: 600;
  color: var(--accent-purple);
}

.detail-tag.screenshot-tag {
  color: var(--accent-cyan);
}

.detail-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.detail-label {
  font-size: 11px;
  color: var(--text-muted);
  min-width: 50px;
  flex-shrink: 0;
}

.detail-value {
  font-size: 12px;
  color: var(--text-secondary);
}

.detail-selector {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 11px;
  color: var(--accent-green);
  background: var(--bg-tertiary);
  padding: 2px 6px;
  border-radius: 4px;
  word-break: break-all;
  cursor: pointer;
  transition: all 150ms ease;
}

.detail-selector:hover {
  background: var(--border-color);
  box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.3);
}

/* Empty state placeholder */
.selection-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px 16px;
  background: var(--bg-secondary);
  border: 2px dashed var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 150ms ease;
}

.selection-placeholder:hover {
  border-color: var(--accent-green);
  background: rgba(34, 197, 94, 0.05);
}

.selection-placeholder:hover .selection-placeholder-icon {
  color: var(--accent-green);
  transform: scale(1.05);
}

.selection-placeholder.active {
  border-color: var(--accent-green);
  border-style: solid;
  background: rgba(34, 197, 94, 0.1);
}

.selection-placeholder.active .selection-placeholder-icon {
  color: var(--accent-green);
  animation: pulse 1s ease-in-out infinite;
}

.selection-placeholder-icon {
  color: var(--text-muted);
  transition: all 150ms ease;
}

.selection-placeholder-text {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.selection-placeholder-hint {
  font-size: 11px;
  color: var(--text-muted);
}
</style>
