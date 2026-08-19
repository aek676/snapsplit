import { describe, expect, it } from 'bun:test';
import { Types } from 'mongoose';
import { createSessionModule } from '../src/modules/session';
import { SessionService } from '../src/modules/session/service';
import { Session } from '../src/schemas';
import { analyzeRequest, fakeExtract } from './fixtures';
import { testStorage } from './setup';

const app = createSessionModule(new SessionService(fakeExtract, testStorage()));

type SessionView = {
  id: string;
  status: string;
  closedAt: string | null;
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

function claim(
  session: { id: string; token: string; lineItems: { id: string }[] },
  units: number,
) {
  return app.handle(
    new Request(
      `http://localhost/sessions/${session.id}/line-items/${session.lineItems[0].id}/claim`,
      {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({ units }),
      },
    ),
  );
}

function close(session: { id: string; token: string }) {
  return app.handle(
    new Request(`http://localhost/sessions/${session.id}/close`, {
      method: 'POST',
      headers: { authorization: `Bearer ${session.token}` },
    }),
  );
}

async function storedSession(sessionId: string) {
  return (await Session.collection.findOne({
    _id: new Types.ObjectId(sessionId),
  })) as unknown as { status: string; closedAt?: Date } | null;
}

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

describe('POST /sessions/:sessionId/close', () => {
  it('closes a fully claimed session and persists it', async () => {
    const session = await openSession();
    expect((await claim(session, 3)).status).toBe(200);

    const res = await close(session);

    expect(res.status).toBe(200);
    const body = (await res.json()) as SessionView;
    expect(body.status).toBe('closed');
    expect(typeof body.closedAt).toBe('string');

    const stored = await storedSession(session.id);
    expect(stored?.status).toBe('closed');
    expect(stored?.closedAt).toBeInstanceOf(Date);
  });

  it('refuses to close while units remain unassigned', async () => {
    const session = await openSession();
    expect((await claim(session, 2)).status).toBe(200);

    const res = await close(session);

    expect(res.status).toBe(409);
    expect(await res.text()).toBe('Some units are still unassigned');
    expect((await storedSession(session.id))?.status).toBe('open');
  });

  it('freezes claims once closed', async () => {
    const session = await openSession();
    expect((await claim(session, 3)).status).toBe(200);
    expect((await close(session)).status).toBe(200);

    const res = await claim(session, 0);

    expect(res.status).toBe(409);
    expect(await res.text()).toBe('Session is not open');
  });

  it('notifies subscribers over SSE', async () => {
    const session = await openSession();
    const controller = new AbortController();

    const res = await app.handle(
      new Request(`http://localhost/sessions/${session.id}/events`, {
        headers: { authorization: `Bearer ${session.token}` },
        signal: controller.signal,
      }),
    );
    expect(res.status).toBe(200);
    const reader = res.body?.getReader();
    if (!reader) throw new Error('no stream body');
    await readUntil(reader, 'connected');

    expect((await claim(session, 3)).status).toBe(200);
    await readUntil(reader, 'claims-updated');

    expect((await close(session)).status).toBe(200);
    const closedEvent = await readUntil(reader, 'session-closed');
    expect(closedEvent).toContain('event: update');
    expect(closedEvent).toContain('session-closed');

    controller.abort();
    await reader.cancel().catch(() => {});
  });
});