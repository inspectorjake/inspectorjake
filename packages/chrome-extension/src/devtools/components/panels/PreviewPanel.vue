<script setup lang="ts">
/**
 * PreviewPanel - Displays element/screenshot preview with measurement annotations.
 * Shows dimension lines, anchor points, and a grid background.
 */

defineProps<{
  image: string | null;
  width: number;
  height: number;
}>();
</script>

<template>
  <div class="h-full border border-obsidian-600 rounded-lg bg-obsidian-800/50 relative overflow-hidden flex flex-col shadow-inner group">
    <!-- Info badge (top-left) -->
    <div
      v-if="image"
      class="absolute top-3 left-3 px-2 py-1 bg-obsidian-700/90 backdrop-blur rounded text-[10px] font-mono text-lime-accent border border-obsidian-600 z-10 shadow-sm flex gap-2"
    >
      <span>PREVIEW: {{ width }} x {{ height }}px</span>
      <span class="text-gray-500">|</span>
      <span class="text-gray-400">100%</span>
    </div>

    <!-- Content area -->
    <div
      class="flex-1 flex items-center justify-center p-12 relative overflow-hidden min-h-0"
      style="background: radial-gradient(ellipse at center, var(--color-obsidian-800), var(--color-obsidian-950))"
    >
      <!-- Grid background pattern -->
      <div
        class="absolute inset-0 opacity-10 pointer-events-none"
        :style="{
          backgroundImage: 'linear-gradient(#3a3a3a 1px, transparent 1px), linear-gradient(90deg, #3a3a3a 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }"
      />

      <!-- Image with measurement annotations -->
      <div v-if="image" class="relative inline-block">
        <!-- The image -->
        <div class="relative z-10 rounded-lg overflow-hidden shadow-2xl border border-obsidian-600 bg-obsidian-900">
          <img
            :src="image"
            :alt="`Preview ${width}x${height}`"
            class="block max-w-[400px] max-h-[400px] w-auto h-auto opacity-90 hover:opacity-100 transition-opacity"
          />
          <!-- Hover overlay -->
          <div class="absolute inset-0 bg-lime-accent/0 group-hover:bg-lime-accent/5 transition-colors pointer-events-none"></div>
        </div>

        <!-- Width measurement (top) -->
        <div class="absolute -top-8 left-0 right-0 flex items-center">
          <!-- Left tick -->
          <div class="w-px h-3 bg-lime-accent shrink-0" />
          <!-- Line -->
          <div class="flex-1 h-px bg-lime-accent relative">
            <!-- Label -->
            <span class="absolute left-1/2 -translate-x-1/2 -top-4 text-[10px] font-mono text-lime-accent whitespace-nowrap bg-obsidian-800/80 px-1 rounded">
              {{ width }}px
            </span>
          </div>
          <!-- Right tick -->
          <div class="w-px h-3 bg-lime-accent shrink-0" />
        </div>

        <!-- Height measurement (left) -->
        <div class="absolute top-0 bottom-0 -left-8 flex flex-col items-center">
          <!-- Top tick -->
          <div class="h-px w-3 bg-lime-accent shrink-0" />
          <!-- Line -->
          <div class="w-px flex-1 bg-lime-accent relative">
            <!-- Label (rotated) -->
            <span
              class="absolute top-1/2 -left-4 -translate-y-1/2 -rotate-90 text-[10px] font-mono text-lime-accent whitespace-nowrap bg-obsidian-800/80 px-1 rounded"
            >
              {{ height }}px
            </span>
          </div>
          <!-- Bottom tick -->
          <div class="h-px w-3 bg-lime-accent shrink-0" />
        </div>

        <!-- Corner anchor points -->
        <!-- Top-left -->
        <div class="absolute -top-1.5 -left-1.5 w-3 h-3 bg-lime-accent border-2 border-black rounded-sm z-20" />
        <!-- Top-right -->
        <div class="absolute -top-1.5 -right-1.5 w-3 h-3 bg-lime-accent border-2 border-black rounded-sm z-20" />
        <!-- Bottom-left -->
        <div class="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-lime-accent border-2 border-black rounded-sm z-20" />
        <!-- Bottom-right -->
        <div class="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-lime-accent border-2 border-black rounded-sm z-20" />
      </div>

      <!-- Placeholder when no image -->
      <div v-else class="flex flex-col items-center justify-center gap-3 text-center">
        <!-- Crosshair icon -->
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="text-gray-600"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="2" x2="12" y2="6" />
          <line x1="12" y1="18" x2="12" y2="22" />
          <line x1="2" y1="12" x2="6" y2="12" />
          <line x1="18" y1="12" x2="22" y2="12" />
        </svg>
        <span class="text-xs text-gray-500 font-mono">No preview available</span>
        <span class="text-[10px] text-gray-600">Select an element to see its preview</span>
      </div>
    </div>
  </div>
</template>
