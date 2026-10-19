<script setup lang="ts">
/**
 * AccessibilityTab - Displays the ARIA subtree (as seen by the MCP agent)
 * and raw ARIA attributes from the selected element.
 */
import { computed } from 'vue';

const props = defineProps<{
  attributes: Array<{ name: string; value: string }> | undefined;
  tagName: string | undefined;
  a11yPath: string | undefined;
}>();

/** Filter to only aria-* attributes */
const ariaAttributes = computed(() => {
  if (!props.attributes) return [];
  return props.attributes.filter((attr) => attr.name.startsWith('aria-') || attr.name === 'role');
});

/** Determine the role display value */
const roleDisplay = computed(() => {
  if (!props.attributes) return null;
  const roleAttr = props.attributes.find((attr) => attr.name === 'role');
  return roleAttr?.value ?? null;
});
</script>

<template>
  <div class="p-3 font-mono text-[12px] leading-relaxed text-ios-label">
    <!-- Empty state -->
    <div
      v-if="!attributes || attributes.length === 0"
      class="flex flex-col items-center justify-center py-8 px-4 text-center gap-1.5 font-display"
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-ios-label-tertiary mb-1" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4" />
        <path d="M12 8h.01" />
      </svg>
      <span class="text-[15px] font-semibold text-ios-label">No accessibility data</span>
      <span class="text-[13px] text-ios-label-secondary">
        Select an element to inspect its ARIA attributes.
      </span>
    </div>

    <!-- Accessibility data -->
    <template v-else>
      <!-- ARIA Subtree (what the MCP agent sees) -->
      <div v-if="a11yPath" class="mb-3 flex flex-col gap-1.5">
        <div class="pl-1 text-[13px] font-display text-ios-label-secondary uppercase tracking-[0.2px]">ARIA Subtree</div>
        <pre class="whitespace-pre-wrap bg-ios-bg rounded-[10px] p-3 overflow-x-auto custom-scrollbar"><code>{{ a11yPath }}</code></pre>
      </div>

      <!-- Raw ARIA attributes -->
      <pre class="whitespace-pre-wrap bg-ios-bg rounded-[10px] p-3"><code><!-- Tag/Role heading -->
<span class="code-syntax-comment">// Element Role</span>
<span class="code-syntax-tag">tagName</span>: <span class="code-syntax-val">"{{ tagName ?? 'unknown' }}"</span>
<template v-if="roleDisplay">
<span class="code-syntax-tag">role</span>: <span class="code-syntax-val">"{{ roleDisplay }}"</span>
</template>

<template v-if="ariaAttributes.length > 0">
<span class="code-syntax-comment">// ARIA Attributes</span>
<template v-for="attr in ariaAttributes" :key="attr.name">
<span class="code-syntax-attr">{{ attr.name }}</span>: <span class="code-syntax-val">"{{ attr.value }}"</span>
</template>
</template>

<span class="code-syntax-comment">// All Attributes ({{ attributes.length }})</span>
<template v-for="attr in attributes" :key="'all-' + attr.name">
<span class="code-syntax-tag">{{ attr.name }}</span>: <span class="code-syntax-val">"{{ attr.value }}"</span>
</template>
</code></pre>
    </template>
  </div>
</template>
