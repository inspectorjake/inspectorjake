<script setup lang="ts">
/**
 * SettingsPanel - iOS-style settings sheet that slides in from the right.
 * Inset grouped sections; every change saves automatically.
 */

import { ref, watch } from 'vue';
import { ComputedStylesMode } from '@inspector-jake/shared';
import { useSettings, ACCENTS, type AccentName } from '../composables/index.js';

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
  accent,
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
  { value: ComputedStylesMode.NONE, label: 'None', description: 'Skip computed styles to save tokens' },
  { value: ComputedStylesMode.LEAN, label: 'Lean', description: 'Layout and visual essentials' },
  { value: ComputedStylesMode.NON_DEFAULT, label: 'Non-Default', description: 'Only what differs from browser defaults' },
  { value: ComputedStylesMode.ALL, label: 'All', description: 'Every computed property' },
] as const;

async function selectStyleMode(mode: ComputedStylesMode): Promise<void> {
  await setComputedStylesMode(mode);
  emit('mode-changed');
}

// --- Accent ---
const ACCENT_OPTIONS = Object.entries(ACCENTS) as Array<[AccentName, (typeof ACCENTS)[AccentName]]>;

function selectAccent(name: AccentName): void {
  accent.value = name;
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
    class="absolute inset-0 z-40 bg-black/40"
    @click="emit('close')"
  />

  <Transition name="settings-slide">
    <div
      v-if="open"
      data-testid="settings-panel"
      class="absolute top-0 right-0 z-50 h-full w-80 max-w-full flex flex-col bg-ios-bg shadow-[-8px_0_30px_rgba(0,0,0,0.6)]"
      role="dialog"
      aria-label="Configuration"
      tabindex="-1"
      @keydown="onKeydown"
    >
      <!-- Navigation bar -->
      <div class="ios-material border-b border-ios-separator min-h-[52px] px-2 flex items-center justify-between shrink-0">
        <span class="w-[64px]" aria-hidden="true" />
        <h2 class="text-[17px] font-semibold text-ios-label">Configuration</h2>
        <button
          class="w-[64px] min-h-[44px] text-[17px] font-semibold text-tint hover:opacity-80 text-right pr-2"
          title="Close settings"
          @click="emit('close')"
        >
          Done
        </button>
      </div>

      <!-- Scrollable content -->
      <div class="flex-1 overflow-y-auto custom-scrollbar px-4 py-5 flex flex-col gap-7">

        <!-- Computed Styles -->
        <section class="flex flex-col gap-1.5">
          <h3 class="pl-4 text-[13px] text-ios-label-secondary uppercase tracking-[0.2px]">Computed Styles</h3>
          <div class="rounded-[14px] bg-ios-elevated overflow-hidden">
            <button
              v-for="mode in STYLE_MODES"
              :key="mode.value"
              :data-testid="`mode-${mode.value}`"
              :aria-pressed="computedStylesMode === mode.value"
              class="relative w-full flex items-center gap-3 pl-4 pr-3 min-h-[56px] text-left hover:bg-white/[0.04]
                     after:absolute after:left-4 after:right-0 after:bottom-0 after:h-px after:bg-ios-separator last:after:hidden"
              @click="selectStyleMode(mode.value)"
            >
              <span class="flex-1 min-w-0 flex flex-col">
                <span class="text-[15px] text-ios-label">{{ mode.label }}</span>
                <span class="text-[12px] text-ios-label-secondary">{{ mode.description }}</span>
              </span>
              <svg
                v-if="computedStylesMode === mode.value"
                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"
                stroke-linecap="round" stroke-linejoin="round" class="text-tint shrink-0" aria-hidden="true"
              >
                <path d="m5 12 5 5L20 7" />
              </svg>
            </button>
          </div>
          <p class="px-4 text-[12px] text-ios-label-secondary">How much CSS goes to Claude with each element capture.</p>
        </section>

        <!-- Accent -->
        <section class="flex flex-col gap-1.5">
          <h3 class="pl-4 text-[13px] text-ios-label-secondary uppercase tracking-[0.2px]">Accent</h3>
          <div class="rounded-[14px] bg-ios-elevated px-4 min-h-[56px] flex items-center justify-between gap-2">
            <button
              v-for="[name, option] in ACCENT_OPTIONS"
              :key="name"
              :data-testid="`accent-${name}`"
              :aria-pressed="accent === name"
              :aria-label="option.label"
              :title="option.label"
              class="w-[44px] h-[44px] rounded-full flex items-center justify-center"
              @click="selectAccent(name)"
            >
              <span
                class="w-[28px] h-[28px] rounded-full transition-shadow"
                :class="accent === name && 'ring-2 ring-offset-2 ring-offset-ios-elevated ring-white'"
                :style="{ background: option.tint }"
              />
            </button>
          </div>
        </section>

        <!-- Screenshot Capture -->
        <section class="flex flex-col gap-1.5">
          <h3 class="pl-4 text-[13px] text-ios-label-secondary uppercase tracking-[0.2px]">Screenshot Capture</h3>
          <div class="rounded-[14px] bg-ios-elevated overflow-hidden">
            <label class="relative flex items-center justify-between gap-3 px-4 min-h-[44px] after:absolute after:left-4 after:right-0 after:bottom-0 after:h-px after:bg-ios-separator">
              <span class="text-[15px] text-ios-label">Max dimension</span>
              <span class="flex items-baseline gap-1">
                <input
                  type="number"
                  :value="draftDimension"
                  min="200"
                  max="2000"
                  step="100"
                  class="w-16 bg-transparent text-right text-[15px] text-ios-label-secondary tabular-nums focus:outline-none focus:text-ios-label
                         [appearance:textfield]
                         [&::-webkit-outer-spin-button]:appearance-none
                         [&::-webkit-inner-spin-button]:appearance-none"
                  @input="onNumberInput"
                />
                <span class="text-[15px] text-ios-label-secondary">px</span>
              </span>
            </label>
            <div class="px-4 py-3 flex items-center gap-3">
              <span class="text-[12px] text-ios-label-secondary tabular-nums">200</span>
              <input
                type="range"
                :value="draftDimension"
                min="200"
                max="2000"
                step="100"
                aria-label="Max screenshot dimension"
                class="settings-range-slider flex-1"
                @input="onSliderInput"
              />
              <span class="text-[12px] text-ios-label-secondary tabular-nums">2000</span>
            </div>
          </div>
          <p class="px-4 text-[12px] text-ios-label-secondary">Larger screenshots are scaled down to fit.</p>
        </section>

        <!-- Selections -->
        <section class="flex flex-col gap-1.5">
          <h3 class="pl-4 text-[13px] text-ios-label-secondary uppercase tracking-[0.2px]">Selections</h3>
          <label class="rounded-[14px] bg-ios-elevated px-4 min-h-[52px] py-2 flex items-center justify-between gap-3 cursor-pointer">
            <span class="text-[15px] text-ios-label">Clear after Claude sees them</span>
            <input
              data-testid="auto-clear-selections"
              type="checkbox"
              role="switch"
              :checked="autoClearSelectionsAfterSeen"
              class="ios-switch"
              @input="onAutoClearInput"
            />
          </label>
          <p class="px-4 text-[12px] text-ios-label-secondary">
            Clears your captures right after <code class="font-mono">see_jakes_notes</code> is called.
          </p>
        </section>

        <p class="text-center text-[12px] text-ios-label-secondary">Inspector Jake v1.0</p>
      </div>
    </div>
  </Transition>
</template>
