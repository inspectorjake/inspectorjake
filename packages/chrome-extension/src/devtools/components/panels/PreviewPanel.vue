<script setup lang="ts">
/**
 * PreviewPanel - Element/screenshot preview card with measurement annotations.
 * Shows dimension lines, anchor points, and a grid background.
 */

defineProps<{
  image: string | null;
  width: number;
  height: number;
  screenshotUnavailableReason?: string;
}>();
</script>

<template>
  <div class="h-full rounded-[14px] bg-ios-elevated p-3 flex flex-col">
    <!-- Content area -->
    <div class="flex-1 rounded-[10px] bg-ios-bg flex items-center justify-center p-12 relative overflow-hidden min-h-0">
      <!-- Grid background pattern -->
      <div
        class="absolute inset-0 opacity-[0.12] pointer-events-none"
        :style="{
          backgroundImage: 'linear-gradient(#48484a 1px, transparent 1px), linear-gradient(90deg, #48484a 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }"
      />

      <!-- Image with measurement annotations -->
      <div v-if="image" class="relative inline-block">
        <div class="relative z-10 rounded-[8px] overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
          <img
            :src="image"
            :alt="`Preview ${width}x${height}`"
            class="block max-w-[400px] max-h-[400px] w-auto h-auto"
          />
        </div>

        <!-- Width measurement (top) -->
        <div class="absolute -top-8 left-0 right-0 flex items-center">
          <div class="w-px h-3 bg-tint shrink-0" />
          <div class="flex-1 h-px bg-tint relative">
            <span class="absolute left-1/2 -translate-x-1/2 -top-[18px] text-[11px] font-semibold tabular-nums text-on-tint bg-tint-fill whitespace-nowrap px-1.5 rounded-[5px]">
              {{ width }}px
            </span>
          </div>
          <div class="w-px h-3 bg-tint shrink-0" />
        </div>

        <!-- Height measurement (left) -->
        <div class="absolute top-0 bottom-0 -left-8 flex flex-col items-center">
          <div class="h-px w-3 bg-tint shrink-0" />
          <div class="w-px flex-1 bg-tint relative">
            <span class="absolute top-1/2 -left-[18px] -translate-y-1/2 -rotate-90 text-[11px] font-semibold tabular-nums text-on-tint bg-tint-fill whitespace-nowrap px-1.5 rounded-[5px]">
              {{ height }}px
            </span>
          </div>
          <div class="h-px w-3 bg-tint shrink-0" />
        </div>

        <!-- Corner anchor points -->
        <div class="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-tint rounded-full z-20" />
        <div class="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-tint rounded-full z-20" />
        <div class="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-tint rounded-full z-20" />
        <div class="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-tint rounded-full z-20" />
      </div>

      <!-- Placeholder: selection exists but screenshot unavailable -->
      <div v-else-if="screenshotUnavailableReason && width > 0" class="flex flex-col items-center justify-center gap-2 text-center">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" class="text-ios-label-tertiary" aria-hidden="true">
          <rect x="2" y="2" width="20" height="20" rx="4" />
          <line x1="2" y1="8" x2="22" y2="8" />
          <line x1="8" y1="2" x2="8" y2="8" />
        </svg>
        <span class="text-[15px] font-semibold text-ios-label tabular-nums">{{ width }} &times; {{ height }}</span>
        <span class="text-[13px] text-ios-label-secondary">{{ screenshotUnavailableReason }}</span>
      </div>

      <!-- Placeholder: nothing selected -->
      <div v-else class="flex flex-col items-center justify-center gap-2 text-center">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" class="text-ios-label-tertiary" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="2" x2="12" y2="6" />
          <line x1="12" y1="18" x2="12" y2="22" />
          <line x1="2" y1="12" x2="6" y2="12" />
          <line x1="18" y1="12" x2="22" y2="12" />
        </svg>
        <span class="text-[15px] font-semibold text-ios-label">No preview</span>
        <span class="text-[13px] text-ios-label-secondary">Select a capture to see it here.</span>
      </div>
    </div>
  </div>
</template>
