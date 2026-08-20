import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test';
import type { ExtractReceipt } from '../src/ai/receipt';
import { createCloseHandler, createShutdownDeps } from '../src/config/shutdown';
import { createSessionModule } from '../src/modules/session';
import { createSessionEvents } from '../src/modules/session/events';
import { SessionService } from '../src/modules/session/service';
import { analyzeRequest, extracted, imageFile } from './fixtures';
import { testStorage } from './setup';

// Its own bus rather than the singleton: `close()` is terminal, and bun shares
// module state between spec files.
const events = createSessionEvents();

// Holds an analyze request inside the handler so a shutdown can catch it
// mid-flight.
let extracting: Promise<void> = Promise.resolve();
const gatedExtract: ExtractReceipt = async () => {
  await extracting;
  return extracted;
};

const app = createSessionModule(
  new SessionService(gatedExtract, testStorage(), events),
  events,
);

type SessionView = {
  id: string;
  code: string;
  auth: { token: string };
};

async function openSession() {
  const draftRes = await app.handle(analyzeRequest());
  const draft = (await draftRes.json()) as SessionView;
  const confirmRes = await app.handle(
    new Request(`http://localhost/sessions/${draft.id}/confirm`, {
      method: 'POST',
      headers: { authorization: `Bearer ${draft.auth.token}` },
    }),
  );
  expect(confirmRes.status).toBe(200);
  return { id: draft.id, token: draft.auth.token };
}

async function readUntil(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  needle: string,
  deadlineMs = 5000,
) {
  const decoder = new TextDecoder();
  let seen = '';
  const deadline = Date.now() + deadlineMs;
  while (Date.now() < deadline) {
    const { value, done } = await reader.read();
    if (done) break;
    seen += decoder.decode(value, { stream: true });
    if (seen.includes(needle)) return seen;
  }
  return seen;
}

function drainOutcome(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  deadlineMs = 2000,
) {
  return Promise.race([
    (async () => {
      try {
        while (true) {
          const { done } = await reader.read();
          if (done) return 'done';
        }
      } catch {
        return 'error';
      }
    })(),
    Bun.sleep(deadlineMs).then(() => 'timeout'),
  ]);
}

describe('shutdown', () => {
  afterEach(async () => {
    if (app.server) await app.stop(true);
    mock.restore();
  });

  it('ends open SSE streams and drains the requests in flight', async () => {
    spyOn(console, 'log').mockImplementation(() => {});

    const session = await openSession();
    app.listen(0);
    const port = app.server?.port;
    if (!port) throw new Error('no server port');

    const res = await fetch(
      `http://localhost:${port}/sessions/${session.id}/events`,
      { headers: { authorization: `Bearer ${session.token}` } },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    const reader = res.body?.getReader();
    if (!reader) throw new Error('no stream body');
    const opening = await readUntil(reader, 'connected');
    expect(opening).toContain('connected');

    const form = new FormData();
    form.append('image', imageFile());
    extracting = Bun.sleep(500);
    const inFlight = fetch(`http://localhost:${port}/sessions/analyze`, {
      method: 'POST',
      body: form,
    });
    await Bun.sleep(50);

    const calls: string[] = [];
    const deps = createShutdownDeps({
      app,
      events,
      disconnect: mock(async () => {}),
    });
    const close = createCloseHandler({
      closeStreams: () => {
        deps.closeStreams();
        calls.push('closeStreams');
      },
      stop: async () => {
        await deps.stop();
        calls.push('stop');
      },
      disconnect: async () => {
        await deps.disconnect();
        calls.push('disconnect');
      },
    });

    await Promise.race([
      close({ signal: 'SIGTERM' }),
      Bun.sleep(5000).then(() => {
        throw new Error('shutdown timed out waiting on open connections');
      }),
    ]);

    expect(calls).toEqual(['closeStreams', 'stop', 'disconnect']);

    expect((await inFlight).status).toBe(200);
    expect(await drainOutcome(reader)).not.toBe('timeout');

    await reader.cancel().catch(() => {});
  });

  it('force-closes connections that do not drain within the deadline', async () => {
    const stop = mock((closeActiveConnections?: boolean) =>
      closeActiveConnections ? Promise.resolve() : new Promise<never>(() => {}),
    );
    const deps = createShutdownDeps(
      {
        app: { stop },
        events: createSessionEvents(),
        disconnect: mock(async () => {}),
      },
      50,
    );

    await Promise.race([
      deps.stop(),
      Bun.sleep(1000).then(() => {
        throw new Error('stop never escalated to a forced close');
      }),
    ]);

    expect(stop).toHaveBeenCalledTimes(2);
    expect(stop).toHaveBeenLastCalledWith(true);
  });
});
