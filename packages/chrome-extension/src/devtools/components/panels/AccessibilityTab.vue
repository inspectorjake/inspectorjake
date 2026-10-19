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

/** Element role, ARIA attributes and all attributes, each as a grouped list */
const attributeGroups = computed(() => {
  const attributes = props.attributes ?? [];
  const groups: Array<{ title: string; ariaNames: boolean; rows: Array<{ name: string; value: string }> }> = [
    {
      title: 'Element Role',
      ariaNames: false,
      rows: [
        { name: 'tagName', value: props.tagName ?? 'unknown' },
        ...(roleDisplay.value ? [{ name: 'role', value: roleDisplay.value }] : []),
      ],
    },
  ];
  if (ariaAttributes.value.length > 0) {
    groups.push({ title: 'ARIA Attributes', ariaNames: true, rows: ariaAttributes.value });
  }
  groups.push({ title: `All Attributes (${attributes.length})`, ariaNames: false, rows: attributes });
  return groups;
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

      <!-- Role and attributes, grouped like iOS Settings -->
      <section
        v-for="group in attributeGroups"
        :key="group.title"
        class="mb-3 last:mb-0 flex flex-col gap-1.5"
      >
        <h3 class="pl-1 text-[13px] font-display font-normal text-ios-label-secondary uppercase tracking-[0.2px]">{{ group.title }}</h3>
        <dl class="m-0 rounded-[10px] bg-ios-bg overflow-hidden">
          <div
            v-for="row in group.rows"
            :key="row.name"
            class="relative flex items-center justify-between gap-3 px-3 min-h-[34px] after:absolute after:left-3 after:right-0 after:bottom-0 after:h-px after:bg-ios-separator last:after:hidden"
          >
            <dt :class="group.ariaNames ? 'code-syntax-attr' : 'code-syntax-tag'">{{ row.name }}</dt>
            <dd class="m-0 code-syntax-val text-right truncate" :title="row.value">"{{ row.value }}"</dd>
          </div>
        </dl>
      </section>
    </template>
  </div>
</template>
