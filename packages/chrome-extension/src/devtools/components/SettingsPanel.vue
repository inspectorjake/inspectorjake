<script setup lang="ts">
/**
 * SettingsPanel - Slide-out configuration panel for Inspector Jake.
 * Industrial/utilitarian control panel aesthetic with auto-save.
 */

import { ref, watch } from 'vue';
import { ComputedStylesMode } from '@inspector-jake/shared';
import { useSettings } from '../composables/index.js';

defineProps<{
  open: boolean
}>();

const emit = defineEmits<{
  close: []
  'mode-changed': []
}>();

const {
  computedStylesMode,
  maxScreenshotDimension,
  autoClearSelectionsAfterSeen,
  setComputedStylesMode,
} = useSettings();

// --- Screenshot Dimension ---
// Local draft synced to the composable ref.
// Writing to maxScreenshotDimension.value auto-persists via the composable's watch.
const draftDimension = ref(maxScreenshotDimension.value);

watch(maxScreenshotDimension, (v) => { draftDimension.value = v; }, { immediate: true });

function clamp(val: number): number {
  return Math.max(200, Math.min(2000, val));
}

function onSliderInput(e: Event): void {
  const val = parseInt((e.target as HTMLInputElement).value, 10);
  if (!isNaN(val)) {
    draftDimension.value = clamp(val);
    maxScreenshotDimension.value = draftDimension.value;
  }
}

function onNumberInput(e: Event): void {
  const val = parseInt((e.target as HTMLInputElement).value, 10);
  if (!isNaN(val)) {
    draftDimension.value = clamp(val);
    maxScreenshotDimension.value = draftDimension.value;
  }
}

function onAutoClearInput(e: Event): void {
  autoClearSelectionsAfterSeen.value = (e.target as HTMLInputElement).checked;
}

// --- Computed Styles Mode ---
const STYLE_MODES = [
  { value: ComputedStylesMode.NONE, label: 'NONE', description: 'Skip computed styles for token savings' },
  { value: ComputedStylesMode.LEAN, label: 'LEAN', description: 'Layout + visual essentials' },
  { value: ComputedStylesMode.NON_DEFAULT, label: 'NON-DEFAULT', description: 'Changed from browser defaults' },
  { value: ComputedStylesMode.ALL, label: 'ALL', description: 'Every computed property' },
] as const;

async function selectStyleMode(mode: ComputedStylesMode): Promise<void> {
  await setComputedStylesMode(mode);
  emit('mode-changed');
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') emit('close');
}
</script>

<template>
  <!-- Backdrop (click-outside to close) -->
  <div
    v-if="open"
    data-testid="settings-backdrop"
    class="absolute inset-0 z-40"
    @click="emit('close')"
  />

  <Transition name="settings-slide">
    <div
      v-if="open"
      data-testid="settings-panel"
      class="absolute top-0 right-0 z-50 h-full w-80 flex flex-col
             bg-obsidian-900 border-l border-obsidian-600
             shadow-[-4px_0_20px_rgba(0,0,0,0.5)]"
      tabindex="-1"
      @keydown="onKeydown"
    >
      <!-- Header -->
      <div class="px-4 py-3 border-b border-obsidian-600 bg-obsidian-950 flex items-center justify-between shrink-0">
        <div class="flex items-center gap-2">
          <div class="w-1 h-4 bg-lime-accent rounded-full" />
          <span class="text-[11px] text-gray-300 uppercase tracking-[0.2em] font-bold">
            Configuration
          </span>
        </div>
        <button
          class="w-6 h-6 rounded flex items-center justify-center
                 text-gray-500 hover:text-white hover:bg-obsidian-700
                 transition-colors"
          title="Close settings"
          @click="emit('close')"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <!-- Scrollable content -->
      <div class="flex-1 overflow-y-auto custom-scrollbar">

        <!-- Section 1: Computed Styles Mode -->
        <div class="p-4">
          <div class="flex items-center gap-2 mb-3">
            <span class="text-[9px] text-gray-500 uppercase tracking-[0.15em] font-bold whitespace-nowrap">
              Computed Styles
            </span>
            <div class="flex-1 h-px bg-obsidian-600" />
          </div>

          <div class="space-y-1.5">
            <button
              v-for="mode in STYLE_MODES"
              :key="mode.value"
              :data-testid="`mode-${mode.value}`"
              class="w-full flex items-center gap-3 px-3 py-2.5 rounded-md
                     border transition-all duration-150"
              :class="computedStylesMode === mode.value
                ? 'bg-obsidian-800 border-lime-accent/40 shadow-[inset_0_0_12px_rgba(190,242,100,0.04)]'
                : 'bg-transparent border-obsidian-700 hover:border-obsidian-500 hover:bg-obsidian-800/30'"
              @click="selectStyleMode(mode.value)"
            >
              <!-- Radio indicator -->
              <div
                class="w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors"
                :class="computedStylesMode === mode.value
                  ? 'border-lime-accent'
                  : 'border-gray-600'"
              >
                <div
                  v-if="computedStylesMode === mode.value"
                  class="w-1.5 h-1.5 rounded-full bg-lime-accent"
                />
              </div>
              <!-- Label + description -->
              <div class="flex flex-col items-start gap-0.5">
                <span
                  class="text-[11px] font-bold font-mono tracking-wide"
                  :class="computedStylesMode === mode.value ? 'text-lime-accent' : 'text-gray-300'"
                >
                  {{ mode.label }}
                </span>
                <span class="text-[9px] text-gray-500 leading-tight">
                  {{ mode.description }}
                </span>
              </div>
            </button>
          </div>
        </div>

        <!-- Divider -->
        <div class="mx-4 h-px bg-obsidian-600" />

        <!-- Section 2: Screenshot Dimension -->
        <div class="p-4">
          <div class="flex items-center gap-2 mb-3">
            <span class="text-[9px] text-gray-500 uppercase tracking-[0.15em] font-bold whitespace-nowrap">
              Screenshot Capture
            </span>
            <div class="flex-1 h-px bg-obsidian-600" />
          </div>

          <label class="block text-[10px] text-gray-400 uppercase tracking-wider mb-2">
            Max Dimension
          </label>

          <!-- Value display -->
          <div class="flex items-baseline gap-1 mb-3">
            <input
              type="number"
              :value="draftDimension"
              min="200"
              max="2000"
              step="100"
              class="w-20 bg-obsidian-800 border border-obsidian-600 rounded px-2 py-1
                     text-right text-sm font-mono font-bold text-white
                     focus:border-lime-accent/50 focus:outline-none transition-colors
                     [appearance:textfield]
                     [&::-webkit-outer-spin-button]:appearance-none
                     [&::-webkit-inner-spin-button]:appearance-none"
              @input="onNumberInput"
            />
            <span class="text-[10px] text-gray-500 font-mono">px</span>
          </div>

          <!-- Range slider -->
          <div class="relative">
            <input
              type="range"
              :value="draftDimension"
              min="200"
              max="2000"
              step="100"
              class="settings-range-slider w-full"
              @input="onSliderInput"
            />
            <div class="flex justify-between mt-1">
              <span class="text-[8px] text-gray-600 font-mono">200</span>
              <span class="text-[8px] text-gray-600 font-mono">2000</span>
            </div>
          </div>

          <p class="text-[9px] text-gray-600 mt-2 leading-relaxed">
            Screenshots exceeding this limit are downscaled proportionally.
          </p>
        </div>

        <!-- Divider -->
        <div class="mx-4 h-px bg-obsidian-600" />

        <!-- Section 3: Selections behavior -->
        <div class="p-4">
          <div class="flex items-center gap-2 mb-3">
            <span class="text-[9px] text-gray-500 uppercase tracking-[0.15em] font-bold whitespace-nowrap">
              Selections
            </span>
            <div class="flex-1 h-px bg-obsidian-600" />
          </div>

          <label
            class="flex items-start gap-2.5 p-2 rounded border border-obsidian-700 hover:border-obsidian-500 cursor-pointer transition-colors"
          >
            <input
              data-testid="auto-clear-selections"
              type="checkbox"
              :checked="autoClearSelectionsAfterSeen"
              class="mt-0.5 accent-lime-accent"
              @input="onAutoClearInput"
            />
            <div>
              <div class="text-[10px] text-gray-300 uppercase tracking-wider font-bold">
                Auto-clear selections after agent has seen them
              </div>
              <p class="text-[9px] text-gray-600 mt-1 leading-relaxed">
                Clears current captures right after <code class="font-mono text-gray-500">get_jakes_notes</code> is called.
              </p>
            </div>
          </label>
        </div>

      </div>

      <!-- Footer -->
      <div class="px-4 py-2 border-t border-obsidian-600 bg-obsidian-950 shrink-0">
        <span class="text-[9px] text-gray-600 font-mono">Inspector Jake v1.0</span>
      </div>
    </div>
  </Transition>
</template>
