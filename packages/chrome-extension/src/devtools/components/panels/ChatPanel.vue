<script setup lang="ts">
/**
 * ChatPanel - Conversation with the Claude Code session the MCP server is attached to.
 * Every message carries the page plus all captures and their notes.
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import type { ChatBridgeInfo, ChatEntry } from '@inspector-jake/shared';

const props = defineProps<{
  messages: ChatEntry[];
  bridgeInfo: ChatBridgeInfo | null;
  draft: string;
  sending: boolean;
  error: string | null;
  captureCount: number;
  noteCount: number;
}>();

const emit = defineEmits<{
  'update:draft': [value: string];
  send: [];
}>();

const listEl = ref<HTMLElement | null>(null);

const available = computed(() => props.bridgeInfo?.available === true);
const peerName = computed(() => props.bridgeInfo?.parentName ?? 'Claude');
const canSend = computed(() => available.value && !props.sending && props.draft.trim().length > 0);

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
  <section class="flex-1 flex flex-col min-h-0 min-w-0 bg-ios-bg" data-testid="chat-panel">
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
      <div ref="listEl" role="log" aria-label="Conversation" class="flex-1 py-2 overflow-y-auto custom-scrollbar flex flex-col gap-1">
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

            <!-- Attachment card for what was sent -->
            <span
              v-if="message.role === 'you' && message.attachments"
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
      </div>

      <!-- Composer -->
      <div class="shrink-0 pt-2 pb-4 flex flex-col gap-2">
        <div class="flex flex-wrap items-center gap-2 px-1">
          <span
            class="text-[12px] font-semibold px-2.5 h-[24px] leading-[24px] rounded-full"
            :class="captureCount > 0 ? 'text-tint bg-tint/15' : 'text-ios-label-secondary bg-ios-elevated'"
            data-testid="chat-attachments"
          >{{ attachmentsLabel }}</span>
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
