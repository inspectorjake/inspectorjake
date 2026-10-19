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
  <section class="flex-1 p-4 flex flex-col min-h-0 min-w-0" data-testid="chat-panel">
    <div class="flex-1 border border-obsidian-600 rounded-lg bg-obsidian-700 flex flex-col min-h-0 overflow-hidden">
      <!-- Header -->
      <div class="px-3 py-1.5 border-b border-obsidian-600 flex items-center gap-2 bg-obsidian-800">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-400">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <span class="text-[10px] font-bold text-gray-300 uppercase tracking-wider">Chat</span>
        <span v-if="available" class="text-[10px] text-gray-500 font-mono truncate">
          with <span class="text-purple-400">{{ peerName }}</span>
        </span>
        <span
          v-if="available && bridgeInfo?.name"
          class="ml-auto text-[9px] text-gray-500 bg-obsidian-600 px-1.5 py-0.5 rounded font-mono"
          :title="`This panel's session name. Claude replies to ${bridgeInfo.name}.`"
        >
          {{ bridgeInfo.name }}
        </span>
      </div>

      <!-- Unavailable -->
      <div
        v-if="bridgeInfo && !available"
        class="m-3 px-3 py-2 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs"
        data-testid="chat-unavailable"
      >
        Chat unavailable: {{ bridgeInfo.reason ?? 'unknown reason' }}
      </div>

      <!-- Messages -->
      <div ref="listEl" class="flex-1 p-3 overflow-y-auto custom-scrollbar bg-obsidian-900/50 flex flex-col gap-2">
        <div
          v-if="messages.length === 0"
          class="m-auto max-w-xs text-center flex flex-col items-center gap-2"
          data-testid="chat-empty"
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-gray-600">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <p class="text-xs text-gray-500 font-mono">Ask {{ peerName }} about this page.</p>
          <p class="text-[10px] text-gray-600">Your captures and their notes are sent with every message.</p>
        </div>

        <template v-for="message in messages" :key="message.id">
          <!-- System notice -->
          <div
            v-if="message.role === 'system'"
            class="self-center text-[10px] text-amber-300/80 font-mono"
            data-testid="chat-message"
            data-role="system"
          >
            {{ message.text }}
          </div>

          <!-- You / Claude -->
          <div
            v-else
            class="max-w-[85%] flex flex-col gap-1"
            :class="message.role === 'you' ? 'self-end items-end' : 'self-start items-start'"
            data-testid="chat-message"
            :data-role="message.role"
          >
            <span v-if="message.role === 'claude'" class="text-[9px] font-bold uppercase tracking-wider text-purple-400">
              {{ message.fromName ?? peerName }}
            </span>
            <div
              class="px-3 py-2 rounded-lg text-xs whitespace-pre-wrap break-words"
              :class="message.role === 'you'
                ? 'bg-lime-accent/10 border border-lime-accent/20 text-gray-100'
                : 'bg-purple-400/10 border border-purple-400/20 text-gray-200'"
            >{{ message.text }}</div>
            <span class="text-[9px] text-gray-600 font-mono">
              {{ formatTime(message.ts) }}
              <template v-if="message.role === 'you' && message.attachments">· {{ message.attachments }} capture{{ message.attachments === 1 ? '' : 's' }}</template>
              <template v-if="message.status === 'sending'">· sending…</template>
              <span v-else-if="message.status === 'failed'" class="text-red-400">· not sent{{ message.error ? `: ${message.error}` : '' }}</span>
            </span>
          </div>
        </template>
      </div>

      <!-- Composer -->
      <div class="p-3 border-t border-obsidian-600 bg-obsidian-800 flex flex-col gap-2">
        <textarea
          :value="draft"
          rows="3"
          class="w-full resize-none bg-obsidian-900 border border-obsidian-600 rounded px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:border-lime-accent/50 focus:outline-none transition-colors disabled:opacity-50"
          :placeholder="available ? `Message ${peerName}… (⌘/Ctrl+Enter to send)` : 'Chat is unavailable'"
          :disabled="!available"
          data-testid="chat-input"
          @input="emit('update:draft', ($event.target as HTMLTextAreaElement).value)"
          @keydown="handleKeydown"
        />
        <div class="flex items-center gap-2">
          <span
            class="text-[10px] font-mono px-1.5 py-0.5 rounded"
            :class="captureCount > 0 ? 'text-lime-accent bg-lime-accent/10' : 'text-gray-500 bg-obsidian-700'"
            data-testid="chat-attachments"
          >
            {{ attachmentsLabel }}
          </span>
          <span v-if="error" class="text-[10px] text-red-300 truncate" :title="error" data-testid="chat-error">{{ error }}</span>
          <button
            class="ml-auto flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-bold uppercase transition-all bg-lime-accent text-obsidian-900 hover:bg-lime-accent/90 disabled:opacity-40 disabled:hover:bg-lime-accent"
            :disabled="!canSend"
            data-testid="chat-send"
            @click="submit"
          >
            <svg v-if="sending" class="animate-spin" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            Send
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
