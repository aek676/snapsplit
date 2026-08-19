import { describe, expect, it } from 'bun:test';
import { createSessionModule } from '../src/modules/session';
import { SessionService } from '../src/modules/session/service';
import { analyzeRequest, fakeExtract } from './fixtures';
import { testStorage } from './setup';

/**
 * The SSE endpoint streams a `connected` event on subscribe and pushes
 * `claims-updated` when any participant writes a claim. The stream ends
 * cleanly when the client aborts.
 */

const app = createSessionModule(new SessionService(fakeExtract, testStorage()));

type SessionView = {
  id: string;
  code: string;
  lineItems: { id: string }[];
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
  const open = (await confirmRes.json()) as SessionView;
  return { ...open, id: draft.id, token: draft.auth.token };
}

/** Reads SSE chunks until `needle` shows up or the deadline passes. */
async function readUntil(
  reader: ReadableStreamDefaultReader<Uint8Array | string>,
  needle: string,
  deadlineMs = 5000,
) {
  const decoder = new TextDecoder();
  let seen = '';
  const deadline = Date.now() + deadlineMs;
  while (Date.now() < deadline) {
    const { value, done } = await reader.read();
    if (done) break;
    seen +=
      typeof value === 'string'
        ? value
        : decoder.decode(value, { stream: true });
    if (seen.includes(needle)) return seen;
  }
  return seen;
}

describe('GET /sessions/:sessionId/events', () => {
  it('requires a bearer token', async () => {
    const session = await openSession();
    const res = await app.handle(
      new Request(`http://localhost/sessions/${session.id}/events`),
    );
    expect(res.status).toBe(401);
  });

  it('streams connected and claims-updated events', async () => {
    const session = await openSession();
    const controller = new AbortController();

    const res = await app.handle(
      new Request(`http://localhost/sessions/${session.id}/events`, {
        headers: { authorization: `Bearer ${session.token}` },
        signal: controller.signal,
      }),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    const reader = res.body?.getReader();
    if (!reader) throw new Error('no stream body');

    const opening = await readUntil(reader, 'connected');
    expect(opening).toContain('connected');

    const claimRes = await app.handle(
      new Request(
        `http://localhost/sessions/${session.id}/line-items/${session.lineItems[0].id}/claim`,
        {
          method: 'PUT',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${session.token}`,
          },
          body: JSON.stringify({ units: 1 }),
        },
      ),
    );
    expect(claimRes.status).toBe(200);

    const update = await readUntil(reader, 'claims-updated');
    expect(update).toContain('claims-updated');

    controller.abort();
    await reader.cancel().catch(() => {});
  });
});
