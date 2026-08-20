import { EventEmitter } from 'node:events';

export const SESSION_EVENT_TYPES = [
  'connected',
  'claims-updated',
  'participant-joined',
  'heartbeat',
] as const;

export type SessionEvent = {
  type: (typeof SESSION_EVENT_TYPES)[number];
  at: string;
};

export interface SessionEvents {
  publish(sessionId: string, event: SessionEvent): void;
  subscribe(
    sessionId: string,
    signal: AbortSignal,
  ): AsyncIterable<SessionEvent>;
  // Ends every open subscription. A shutdown can only drain in-flight requests
  // once these streams finish: left alone they run until the client hangs up.
  close(): void;
}

const HEARTBEAT_MS = 15_000;

// In-memory bus: enough while the API runs as a single instance. To fan out
// across instances, swap this implementation for one backed by a MongoDB
// Change Stream on the session document (SRS §7) without touching callers.
export function createSessionEvents(): SessionEvents {
  const emitter = new EventEmitter();
  emitter.setMaxListeners(0);
  const closing = new AbortController();

  return {
    publish(sessionId, event) {
      emitter.emit(sessionId, event);
    },

    close() {
      closing.abort();
    },

    async *subscribe(sessionId, signal) {
      let queue: SessionEvent[] = [];
      let wake = () => {};
      const stopped = () => signal.aborted || closing.signal.aborted;
      const onEvent = (event: SessionEvent) => {
        queue.push(event);
        wake();
      };
      const onAbort = () => wake();
      emitter.on(sessionId, onEvent);
      signal.addEventListener('abort', onAbort);
      closing.signal.addEventListener('abort', onAbort);

      try {
        while (!stopped()) {
          if (queue.length === 0) {
            await new Promise<void>((resolve) => {
              wake = resolve;
              const timer = setTimeout(resolve, HEARTBEAT_MS);
              timer.unref?.();
            });
            wake = () => {};
          }
          if (stopped()) return;
          if (queue.length > 0) {
            const batch = queue;
            queue = [];
            yield* batch;
          } else {
            yield { type: 'heartbeat', at: new Date().toISOString() };
          }
        }
      } finally {
        emitter.off(sessionId, onEvent);
        signal.removeEventListener('abort', onAbort);
        closing.signal.removeEventListener('abort', onAbort);
      }
    },
  };
}

export const sessionEvents = createSessionEvents();
