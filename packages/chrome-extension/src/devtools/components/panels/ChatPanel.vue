<script setup lang="ts">
/**
 * ChatPanel - Conversation with the Claude Code session the MCP server is attached to.
 * Every message carries the page plus all captures and their notes.
 */
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import type { ChatBridgeInfo, ChatEntry, ChatThumbnail } from '@inspector-jake/shared';

const props = defineProps<{
  messages: ChatEntry[];
  bridgeInfo: ChatBridgeInfo | null;
  draft: string;
  sending: boolean;
  error: string | null;
  captureCount: number;
  noteCount: number;
  /** The element picker is running */
  picking?: boolean;
}>();

const emit = defineEmits<{
  'update:draft': [value: string];
  send: [];
  /** Start the element picker, as Pick Element does */
  pick: [];
}>();

const listEl = ref<HTMLElement | null>(null);

/** Thumbnails shown per message; the rest collapse into "+N" */
const MAX_THUMBNAILS = 4;

/** How long Claude shows as typing after a message lands. It may finish without replying. */
const REPLY_WAIT_MS = 10 * 60 * 1000;

function thumbnailTitle(thumb: ChatThumbnail): string {
  return thumb.note ? `${thumb.label} · “${thumb.note}”` : thumb.label;
}

const available = computed(() => props.bridgeInfo?.available === true);
const peerName = computed(() => props.bridgeInfo?.parentName ?? 'Claude');
const canSend = computed(() => available.value && !props.sending && props.draft.trim().length > 0);

// Claude is "typing" from the moment your message is delivered until anything follows it:
// a reply, or a notice such as "held for approval"
const now = ref(Date.now());
let waitTimer: ReturnType<typeof setTimeout> | undefined;

const waitingSince = computed(() => {
  const last = props.messages[props.messages.length - 1];
  return last?.role === 'you' && last.status === 'sent' ? last.ts : null;
});
const awaitingReply = computed(
  () => available.value && waitingSince.value !== null && now.value - waitingSince.value < REPLY_WAIT_MS
);

watch(waitingSince, (since) => {
  clearTimeout(waitTimer);
  now.value = Date.now();
  if (since !== null) {
    waitTimer = setTimeout(() => (now.value = Date.now()), since + REPLY_WAIT_MS - now.value);
  }
}, { immediate: true });
onUnmounted(() => clearTimeout(waitTimer));

const attachmentsLabel = computed(() => {
  if (props.captureCount === 0) return 'No captures attached';
  const captures = `${props.captureCount} capture${props.captureCount === 1 ? '' : 's'}`;
  return props.noteCount > 0 ? `Includes ${captures} (${props.noteCount} with notes)` : `Includes ${captures}`;
});

async function scrollToBottom(): Promise<void> {
  await nextTick();
  if (listEl.value) {
    listEl.value.scrollTop = listEl.value.scrollHeight;
  }
}

watch(() => props.messages.length, scrollToBottom);
watch(awaitingReply, (waiting) => waiting && scrollToBottom());
onMounted(scrollToBottom);

function submit(): void {
  if (canSend.value) emit('send');
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    submit();
  }
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
</script>

<template>
  <section class="flex-1 flex flex-col min-h-0 min-w-0 bg-ios-bg overflow-y-auto custom-scrollbar" data-testid="chat-panel">
    <!-- Fits the pane, so the log scrolls; in a short window the log keeps its minimum and the pane scrolls -->
    <div class="flex-1 w-full max-w-[880px] mx-auto px-4 flex flex-col min-h-0">
      <!-- Contact header -->
      <div class="flex flex-col items-center gap-1 pt-4 pb-2 shrink-0 text-center">
        <div class="w-[44px] h-[44px] rounded-full bg-ios-fill-strong text-ios-label flex items-center justify-center" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="16" rx="3" />
            <path d="m7 10 3 2-3 2" />
            <path d="M12 15h5" />
          </svg>
        </div>
        <h2 class="text-[15px] font-semibold text-ios-label">{{ available ? peerName : 'Chat' }}</h2>
        <p v-if="available && bridgeInfo?.name" class="text-[12px] text-ios-label-secondary">
          Claude Code session · replies to <span class="font-mono">{{ bridgeInfo.name }}</span>
        </p>
      </div>

      <!-- Unavailable -->
      <div
        v-if="bridgeInfo && !available"
        role="status"
        class="mb-2 px-4 py-3 rounded-[14px] bg-ios-orange/15 text-ios-yellow text-[13px] flex items-start gap-2.5"
        data-testid="chat-unavailable"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 mt-px" aria-hidden="true">
          <path d="M12 3 2 20h20z" />
          <path d="M12 10v4M12 17h.01" />
        </svg>
        <span>Chat unavailable: {{ bridgeInfo.reason ?? 'unknown reason' }}</span>
      </div>

      <!-- Messages -->
      <div ref="listEl" role="log" aria-label="Conversation" class="flex-1 min-h-[160px] py-2 overflow-y-auto custom-scrollbar flex flex-col gap-1">
        <div
          v-if="messages.length === 0"
          class="m-auto max-w-xs text-center flex flex-col items-center gap-1.5"
          data-testid="chat-empty"
        >
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-ios-label-tertiary mb-1" aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <p class="text-[15px] font-semibold text-ios-label">Ask {{ peerName }} about this page.</p>
          <p class="text-[13px] text-ios-label-secondary">Your captures and their notes are sent with every message.</p>
        </div>

        <template v-for="message in messages" :key="message.id">
          <!-- System notice -->
          <p
            v-if="message.role === 'system'"
            class="self-center max-w-[460px] text-center text-[12px] text-ios-yellow my-2"
            data-testid="chat-message"
            data-role="system"
          >
            {{ message.text }}
          </p>

          <!-- You / Claude -->
          <div
            v-else
            class="max-w-[75%] flex flex-col gap-1 mt-1.5"
            :class="message.role === 'you' ? 'self-end items-end' : 'self-start items-start'"
            data-testid="chat-message"
            :data-role="message.role"
          >
            <span v-if="message.role === 'claude'" class="text-[12px] text-ios-label-secondary pl-3.5">
              {{ message.fromName ?? peerName }}
            </span>

            <!-- Thumbnails of the captures that went with it -->
            <div
              v-if="message.role === 'you' && message.thumbnails?.length"
              class="flex items-center gap-1.5"
              role="group"
              :aria-label="`${message.thumbnails.length} capture${message.thumbnails.length === 1 ? '' : 's'}`"
              data-testid="chat-thumbnails"
            >
              <span
                v-for="thumb in message.thumbnails.slice(0, MAX_THUMBNAILS)"
                :key="thumb.id"
                class="relative w-[44px] h-[44px] rounded-[10px] bg-ios-fill overflow-hidden flex items-center justify-center shadow-[inset_0_0_0_0.5px_var(--color-ios-separator)]"
                :title="thumbnailTitle(thumb)"
                data-testid="chat-thumbnail"
              >
                <img v-if="thumb.src" :src="thumb.src" :alt="thumb.label" class="w-full h-full object-cover" />
                <span v-else class="px-1 text-[10px] font-mono text-ios-label-secondary truncate">{{ thumb.label }}</span>
                <!-- Notes ride along: mark the captures that have one -->
                <span v-if="thumb.note" class="absolute right-[3px] top-[3px] w-[7px] h-[7px] rounded-full bg-ios-yellow shadow-[0_0_0_1.5px_var(--color-ios-bg)]" aria-hidden="true" />
              </span>
              <span
                v-if="message.thumbnails.length > MAX_THUMBNAILS"
                class="h-[44px] px-2 rounded-[10px] bg-ios-elevated text-[12px] font-semibold text-ios-label-secondary flex items-center"
              >+{{ message.thumbnails.length - MAX_THUMBNAILS }}</span>
            </div>

            <!-- Older messages: a count of what was sent -->
            <span
              v-else-if="message.role === 'you' && message.attachments"
              class="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-[14px] bg-ios-elevated shadow-[inset_0_0_0_0.5px_var(--color-ios-separator)] text-[12px] font-semibold text-ios-label"
            >
              <span class="w-[24px] h-[24px] rounded-[6px] bg-ios-fill text-ios-label-secondary flex items-center justify-center" aria-hidden="true">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m9 18-6-6 6-6M15 6l6 6-6 6" />
                </svg>
              </span>
              {{ message.attachments }} capture{{ message.attachments === 1 ? '' : 's' }}
            </span>

            <div
              class="px-3.5 py-2 text-[15px] leading-snug whitespace-pre-wrap break-words"
              :class="message.role === 'you'
                ? 'bg-tint-fill text-on-tint rounded-[18px] rounded-br-[5px]'
                : 'bg-ios-fill text-ios-label rounded-[18px] rounded-bl-[5px]'"
            >{{ message.text }}</div>

            <span class="text-[11px] text-ios-label-secondary tabular-nums px-1">
              {{ formatTime(message.ts) }}
              <template v-if="message.status === 'sending'">· Sending…</template>
              <span v-else-if="message.status === 'failed'" class="text-ios-red">· not sent{{ message.error ? `: ${message.error}` : '' }}</span>
            </span>
          </div>
        </template>

        <!-- Claude is working on it -->
        <div
          v-if="awaitingReply"
          class="self-start flex flex-col items-start gap-1 mt-1.5"
          role="status"
          :aria-label="`${peerName} is typing`"
          data-testid="chat-typing"
        >
          <span class="text-[12px] text-ios-label-secondary pl-3.5" aria-hidden="true">{{ peerName }}</span>
          <div class="h-[36px] px-3.5 rounded-[18px] rounded-bl-[5px] bg-ios-fill flex items-center gap-[5px]" aria-hidden="true">
            <span
              v-for="dot in 3"
              :key="dot"
              class="w-[8px] h-[8px] rounded-full bg-ios-label-secondary animate-typing-dot motion-reduce:animate-none"
              :style="{ animationDelay: `${(dot - 1) * 0.18}s` }"
            />
          </div>
        </div>
      </div>

      <!-- Composer -->
      <div class="shrink-0 pt-2 pb-4 flex flex-col gap-2">
        <div class="flex flex-wrap items-center gap-2 px-1">
          <span
            v-if="captureCount > 0"
            class="text-[12px] font-semibold px-2.5 h-[24px] leading-[24px] rounded-full text-tint bg-tint/15"
            data-testid="chat-attachments"
          >{{ attachmentsLabel }}</span>
          <!-- Nothing attached: clicking it is the same as Pick Element -->
          <button
            v-else
            type="button"
            class="text-[12px] font-semibold px-2.5 h-[24px] rounded-full flex items-center gap-1 transition-colors"
            :class="picking ? 'text-tint bg-tint/15 animate-pulse' : 'text-ios-label-secondary bg-ios-elevated hover:text-tint hover:bg-tint/15'"
            title="Pick an element, or drag a region to capture it"
            data-testid="chat-attachments"
            @click.stop="emit('pick')"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="m4 4 7 17 2.5-7.5L21 11z" />
            </svg>
            {{ picking ? 'Click an element…' : attachmentsLabel }}
          </button>
          <span v-if="error" class="text-[12px] text-ios-red truncate" :title="error" data-testid="chat-error">{{ error }}</span>
        </div>

        <div
          class="flex items-end gap-2 rounded-[20px] pl-4 pr-1 py-1 shadow-[inset_0_0_0_1px_var(--color-ios-fill-strong)] focus-within:shadow-[inset_0_0_0_1.5px_var(--color-tint)] transition-shadow"
          :class="!available && 'opacity-50'"
        >
          <label for="chat-draft" class="sr-only">Message {{ peerName }}</label>
          <textarea
            id="chat-draft"
            :value="draft"
            rows="1"
            class="flex-1 min-w-0 max-h-[140px] field-sizing-content resize-none bg-transparent py-1.5 text-[15px] leading-snug text-ios-label placeholder:text-ios-label-tertiary focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed"
            :placeholder="available ? `Message ${peerName} · ⌘/Ctrl+Enter to send` : 'Chat is unavailable'"
            :disabled="!available"
            data-testid="chat-input"
            @input="emit('update:draft', ($event.target as HTMLTextAreaElement).value)"
            @keydown="handleKeydown"
          />
          <button
            class="w-[32px] h-[32px] mb-px rounded-full flex items-center justify-center shrink-0 transition-colors"
            :class="canSend ? 'bg-tint-fill text-on-tint' : 'bg-ios-fill-strong text-ios-label-tertiary'"
            :disabled="!canSend"
            aria-label="Send"
            data-testid="chat-send"
            @click="submit"
          >
            <svg v-if="sending" class="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
