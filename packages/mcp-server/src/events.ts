/**
 * Jake MCP - Event Queue System
 *
 * Handles browser events pushed from Chrome extension.
 * Events are queued and can be consumed by MCP tools or createMessage().
 */

import { log } from './logger.js';

export interface BrowserEvent {
  id: string;
  type: 'element_selected' | 'button_clicked' | 'custom';
  timestamp: number;
  payload: unknown;
}

const eventQueue: BrowserEvent[] = [];
const eventListeners: ((event: BrowserEvent) => void)[] = [];

// Pending waiters for waitForEvent()
interface EventWaiter {
  resolve: (event: BrowserEvent | null) => void;
  timeoutId: NodeJS.Timeout;
}
const pendingWaiters: EventWaiter[] = [];

/**
 * Push a new event to the queue and notify listeners
 */
export function pushEvent(event: BrowserEvent): void {
  log.debug('Events', 'Event pushed:', event.type, event.id);
  eventQueue.push(event);

  // Notify all listeners
  eventListeners.forEach((listener) => {
    try {
      listener(event);
    } catch (err) {
      log.error('Events', 'Listener error:', err);
    }
  });

  // Resolve any pending waiters
  if (pendingWaiters.length > 0) {
    const waiter = pendingWaiters.shift()!;
    clearTimeout(waiter.timeoutId);
    waiter.resolve(event);
    log.trace('Events', 'Waiter resolved with event');
  }
}

/**
 * Pop the oldest event from the queue
 */
export function popEvent(): BrowserEvent | undefined {
  return eventQueue.shift();
}

/**
 * Get queue length
 */
export function getQueueLength(): number {
  return eventQueue.length;
}

/**
 * Register a listener for new events
 */
export function onEvent(listener: (event: BrowserEvent) => void): () => void {
  eventListeners.push(listener);
  log.trace('Events', 'Listener registered, total:', eventListeners.length);

  // Return unsubscribe function
  return () => {
    const idx = eventListeners.indexOf(listener);
    if (idx >= 0) {
      eventListeners.splice(idx, 1);
      log.trace('Events', 'Listener removed, total:', eventListeners.length);
    }
  };
}

/**
 * Wait for the next event (or timeout)
 * Used by wait_for_browser_event tool
 */
export function waitForEvent(timeoutMs: number = 30000): Promise<BrowserEvent | null> {
  // If there's already an event in queue, return it immediately
  const existing = popEvent();
  if (existing) {
    log.trace('Events', 'Returning existing event from queue');
    return Promise.resolve(existing);
  }

  // Otherwise wait for one
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      // Remove from pending waiters
      const idx = pendingWaiters.findIndex((w) => w.resolve === resolve);
      if (idx >= 0) {
        pendingWaiters.splice(idx, 1);
      }
      log.trace('Events', 'Wait timed out after', timeoutMs, 'ms');
      resolve(null);
    }, timeoutMs);

    pendingWaiters.push({ resolve, timeoutId });
    log.trace('Events', 'Waiting for event, timeout:', timeoutMs, 'ms');
  });
}

/**
 * Clear all events and waiters (for cleanup)
 */
export function clearAll(): void {
  eventQueue.length = 0;
  pendingWaiters.forEach((w) => {
    clearTimeout(w.timeoutId);
    w.resolve(null);
  });
  pendingWaiters.length = 0;
  log.debug('Events', 'Cleared all events and waiters');
}
