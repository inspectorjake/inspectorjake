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
  <div class="p-4 font-mono text-sm leading-relaxed">
    <!-- Empty state -->
    <div
      v-if="!attributes || attributes.length === 0"
      class="flex flex-col items-center justify-center py-8 px-4 text-center"
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        class="text-gray-600 mb-3"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4" />
        <path d="M12 8h.01" />
      </svg>
      <span class="text-xs text-gray-500">
        No accessibility data available
      </span>
      <span class="text-[10px] text-gray-600 mt-1">
        Select an element to inspect ARIA attributes
      </span>
    </div>

    <!-- Accessibility data -->
    <template v-else>
      <!-- ARIA Subtree (what the MCP agent sees) -->
      <div v-if="a11yPath" class="mb-4">
        <div class="text-[10px] text-gray-500 uppercase tracking-wider mb-2 font-bold">ARIA Subtree</div>
        <pre class="whitespace-pre-wrap text-xs bg-obsidian-800 border border-obsidian-600 rounded-lg p-3 overflow-x-auto"><code>{{ a11yPath }}</code></pre>
      </div>

      <!-- Raw ARIA attributes -->
      <pre class="whitespace-pre-wrap"><code><!-- Tag/Role heading -->
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
