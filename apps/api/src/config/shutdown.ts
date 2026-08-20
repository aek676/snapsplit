type CloseDeps = {
  closeStreams: () => void;
  stop: () => Promise<unknown>;
  disconnect: () => Promise<void>;
};

type Runtime = {
  app: { stop: (closeActiveConnections?: boolean) => Promise<unknown> };
  events: { close: () => void };
  disconnect: () => Promise<void>;
};

// Must stay below close-with-grace's delay in index.ts, or the escalation to
// a forced stop never runs and `disconnect` is skipped by `process.exit(1)`.
const DRAIN_DEADLINE_MS = 5_000;

export function createShutdownDeps(
  { app, events, disconnect }: Runtime,
  drainMs = DRAIN_DEADLINE_MS,
): CloseDeps {
  return {
    closeStreams: () => events.close(),
    stop: async () => {
      const drained = await Promise.race([
        app.stop().then(() => true),
        Bun.sleep(drainMs).then(() => false),
      ]);
      if (!drained) await app.stop(true);
    },
    disconnect,
  };
}

export function createCloseHandler({
  closeStreams,
  stop,
  disconnect,
}: CloseDeps) {
  return async ({ err, signal }: { err?: Error; signal?: string }) => {
    if (err) console.error(err);
    console.log(`${signal ?? 'close'} received, shutting down`);
    closeStreams();
    await stop();
    await disconnect();
  };
}
