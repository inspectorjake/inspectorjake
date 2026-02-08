<script setup lang="ts">
// Settings dropdown panel for Inspector Jake.
// Compact overlay anchored to the top-right, below the gear icon.

defineProps<{
  maxScreenshotDimension: number
}>()

const emit = defineEmits<{
  'update:maxScreenshotDimension': [value: number]
}>()

function clamp(val: number): number {
  return Math.max(200, Math.min(2000, val))
}

function step(delta: number, current: number): void {
  emit('update:maxScreenshotDimension', clamp(current + delta))
}

function onInput(e: Event): void {
  const val = parseInt((e.target as HTMLInputElement).value, 10)
  if (!isNaN(val)) emit('update:maxScreenshotDimension', clamp(val))
}
</script>

<template>
  <div class="absolute top-12 right-4 z-50 w-64 bg-obsidian-800 border border-obsidian-600 rounded-lg shadow-2xl overflow-hidden">
    <!-- Header -->
    <div class="px-3 py-2 border-b border-obsidian-600 bg-obsidian-900/50">
      <span class="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Settings</span>
    </div>

    <!-- Max Screenshot Dimension -->
    <div class="p-3">
      <label class="block text-[10px] text-gray-400 uppercase tracking-wider mb-2">
        Max Screenshot Size
      </label>
      <div class="flex items-center gap-2">
        <button
          class="w-7 h-7 rounded bg-obsidian-700 border border-obsidian-600 text-gray-400 hover:text-lime-accent hover:border-lime-accent/50 transition-colors flex items-center justify-center text-sm font-bold"
          @click="step(-100, maxScreenshotDimension)"
        >
          &minus;
        </button>
        <div class="flex-1 relative">
          <input
            type="number"
            :value="maxScreenshotDimension"
            min="200"
            max="2000"
            step="100"
            class="w-full bg-obsidian-900 border border-obsidian-600 rounded px-2 py-1 text-center text-sm font-mono text-white focus:border-lime-accent/50 focus:outline-none transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            @change="onInput"
          />
          <span class="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-500 pointer-events-none">px</span>
        </div>
        <button
          class="w-7 h-7 rounded bg-obsidian-700 border border-obsidian-600 text-gray-400 hover:text-lime-accent hover:border-lime-accent/50 transition-colors flex items-center justify-center text-sm font-bold"
          @click="step(100, maxScreenshotDimension)"
        >
          +
        </button>
      </div>
      <p class="text-[9px] text-gray-600 mt-1.5">
        Screenshots exceeding this limit are downscaled proportionally.
      </p>
    </div>
  </div>
</template>
