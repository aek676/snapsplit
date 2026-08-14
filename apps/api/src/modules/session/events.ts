import { EventEmitter } from 'node:events';

export type SessionEvent = {
  type: 'connected' | 'claims-updated' | 'participant-joined' | 'heartbeat';
  at: string;
};

export interface SessionEvents {
  publish(sessionId: string, event: SessionEvent): void;
  subscribe(
    sessionId: string,
    signal: AbortSignal,
  ): AsyncIterable<SessionEvent>;
}

const HEARTBEAT_MS = 15_000;

// In-memory bus: enough while the API runs as a single instance. To fan out
// across instances, swap this implementation for one backed by a MongoDB
// Change Stream on the session document (SRS §7) without touching callers.
export function createSessionEvents(): SessionEvents {
  const emitter = new EventEmitter();
  emitter.setMaxListeners(0);

  return {
    publish(sessionId, event) {
      emitter.emit(sessionId, event);
    },

    async *subscribe(sessionId, signal) {
      let queue: SessionEvent[] = [];
      let wake = () => {};
      const onEvent = (event: SessionEvent) => {
        queue.push(event);
        wake();
      };
      const onAbort = () => wake();
      emitter.on(sessionId, onEvent);
      signal.addEventListener('abort', onAbort);

      try {
        while (!signal.aborted) {
          if (queue.length === 0) {
            await new Promise<void>((resolve) => {
              wake = resolve;
              const timer = setTimeout(resolve, HEARTBEAT_MS);
              timer.unref?.();
            });
            wake = () => {};
          }
          if (signal.aborted) return;
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
      }
    },
  };
}

export const sessionEvents = createSessionEvents();
