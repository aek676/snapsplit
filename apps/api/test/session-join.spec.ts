import { beforeAll, describe, expect, it } from 'bun:test';
import { Types } from 'mongoose';
import { hashToken } from '../src/modules/auth/service';
import { createSessionModule } from '../src/modules/session';
import { SessionService } from '../src/modules/session/service';
import { Session } from '../src/schemas';
import { analyzeRequest, fakeExtract } from './fixtures';
import { testStorage } from './setup';

const app = createSessionModule(new SessionService(fakeExtract, testStorage()));

type Auth = { participantId: string; token: string };
type Draft = { id: string; auth: Auth };
type JoinResponse = {
  id: string;
  status: string;
  auth: { participantId: string; token?: string };
};

async function createOpenSession() {
  const analyzeRes = await app.handle(analyzeRequest());
  expect(analyzeRes.status).toBe(200);
  const draft = (await analyzeRes.json()) as Draft;

  const confirmRes = await app.handle(
    new Request(`http://localhost/sessions/${draft.id}/confirm`, {
      method: 'POST',
      headers: { authorization: `Bearer ${draft.auth.token}` },
    }),
  );
  expect(confirmRes.status).toBe(200);
  const { code } = (await confirmRes.json()) as { code: string };

  return { ...draft, code };
}

function join(code: string, name: string, token?: string, scheme = 'Bearer') {
  return app.handle(
    new Request(`http://localhost/sessions/join/${code}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `${scheme} ${token}` } : {}),
      },
      body: JSON.stringify({ name }),
    }),
  );
}

function availability(code: string) {
  return app.handle(new Request(`http://localhost/sessions/join/${code}`));
}

async function storedParticipants(sessionId: string) {
  const raw = await Session.collection.findOne({
    _id: new Types.ObjectId(sessionId),
  });
  return (raw?.participants ?? []) as {
    _id: Types.ObjectId;
    name?: string;
    isOwner: boolean;
    deviceTokenHash: string;
  }[];
}

beforeAll(async () => {
  await Session.syncIndexes();
});

describe('a guest joins with the share code', () => {
  it('adds a non-owner participant and hands back a fresh token', async () => {
    const session = await createOpenSession();

    const res = await join(session.code, 'Marta');

    expect(res.status).toBe(200);
    const body = (await res.json()) as JoinResponse;
    expect(body).toMatchObject({ id: session.id, status: 'open' });
    expect(body.auth.token).toBeDefined();
    expect(body.auth.token).not.toBe(session.auth.token);

    const participants = await storedParticipants(session.id);
    expect(participants).toHaveLength(2);
    const guest = participants.find(
      (participant) => String(participant._id) === body.auth.participantId,
    );
    expect(guest).toMatchObject({ name: 'Marta', isOwner: false });
    expect(guest?.deviceTokenHash).toBe(hashToken(body.auth.token as string));
  });

  it('accepts the code in lowercase', async () => {
    const session = await createOpenSession();

    const res = await join(session.code.toLowerCase(), 'Marta');

    expect(res.status).toBe(200);
    expect(((await res.json()) as JoinResponse).id).toBe(session.id);
  });

  it('does not leak secrets in the response', async () => {
    const session = await createOpenSession();

    const res = await join(session.code, 'Marta');

    const text = await res.text();
    expect(text).not.toContain('deviceTokenHash');
    expect(text).not.toContain(session.auth.token);
  });

  it('issues a token that can read the session but not edit it', async () => {
    const session = await createOpenSession();

    const joinRes = await join(session.code, 'Marta');
    const guest = (await joinRes.json()) as JoinResponse;
    const headers = { authorization: `Bearer ${guest.auth.token}` };

    const getRes = await app.handle(
      new Request(`http://localhost/sessions/${session.id}`, { headers }),
    );
    expect(getRes.status).toBe(200);

    const patchRes = await app.handle(
      new Request(`http://localhost/sessions/${session.id}`, {
        method: 'PATCH',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({ merchant: 'Bar Ajeno' }),
      }),
    );
    expect(patchRes.status).toBe(403);
  });

  it('treats a token from another session as a new guest', async () => {
    const session = await createOpenSession();
    const other = await createOpenSession();

    const res = await join(session.code, 'Intruso', other.auth.token);

    expect(res.status).toBe(200);
    const body = (await res.json()) as JoinResponse;
    expect(body.auth.token).toBeDefined();
    expect(await storedParticipants(session.id)).toHaveLength(2);
    expect(await storedParticipants(other.id)).toHaveLength(1);
  });
});

describe('a participant re-joins with their bearer', () => {
  it('renames the owner without duplicating them or minting a token', async () => {
    const session = await createOpenSession();

    const res = await join(session.code, 'Paco', session.auth.token);

    expect(res.status).toBe(200);
    const body = (await res.json()) as JoinResponse;
    expect(body.auth.participantId).toBe(session.auth.participantId);
    expect(body.auth.token).toBeUndefined();

    const participants = await storedParticipants(session.id);
    expect(participants).toHaveLength(1);
    expect(participants[0]).toMatchObject({ name: 'Paco', isOwner: true });
  });

  it('accepts a lowercase bearer scheme, like every other route', async () => {
    const session = await createOpenSession();

    const res = await join(session.code, 'Paco', session.auth.token, 'bearer');

    expect(res.status).toBe(200);
    const body = (await res.json()) as JoinResponse;
    expect(body.auth.participantId).toBe(session.auth.participantId);
    expect(body.auth.token).toBeUndefined();
    expect(await storedParticipants(session.id)).toHaveLength(1);
  });

  it('is idempotent for a guest: same participant, latest name wins', async () => {
    const session = await createOpenSession();

    const first = (await (
      await join(session.code, 'Marta')
    ).json()) as JoinResponse;

    const again = await join(session.code, 'Marta B.', first.auth.token);

    expect(again.status).toBe(200);
    const body = (await again.json()) as JoinResponse;
    expect(body.auth.participantId).toBe(first.auth.participantId);
    expect(body.auth.token).toBeUndefined();

    const participants = await storedParticipants(session.id);
    expect(participants).toHaveLength(2);
    const guest = participants.find(
      (participant) => String(participant._id) === first.auth.participantId,
    );
    expect(guest?.name).toBe('Marta B.');
  });

  it('lets a participant back into a closed session without renaming them', async () => {
    const session = await createOpenSession();
    const first = (await (
      await join(session.code, 'Marta')
    ).json()) as JoinResponse;
    await Session.updateOne({ code: session.code }, { status: 'closed' });

    const res = await join(session.code, 'Marta B.', first.auth.token);

    expect(res.status).toBe(200);
    const body = (await res.json()) as JoinResponse;
    expect(body.status).toBe('closed');
    expect(body.auth.participantId).toBe(first.auth.participantId);
    expect(body.auth.token).toBeUndefined();

    const participants = await storedParticipants(session.id);
    expect(participants).toHaveLength(2);
    const guest = participants.find(
      (participant) => String(participant._id) === first.auth.participantId,
    );
    expect(guest?.name).toBe('Marta');
  });
});

describe('joining a session that cannot be joined', () => {
  it('returns 404 for a well-formed code that does not exist', async () => {
    const res = await join('ABCDEFGH', 'Marta');

    expect(res.status).toBe(404);
    expect(await res.text()).toBe('Session not found');
  });

  it('answers a closed session exactly like an unknown code', async () => {
    const session = await createOpenSession();
    await Session.updateOne({ code: session.code }, { status: 'closed' });

    const res = await join(session.code, 'Marta');

    expect(res.status).toBe(404);
    expect(await res.text()).toBe('Session not found');
  });

  it('keeps answering 404 to a bearer from another session once closed', async () => {
    const session = await createOpenSession();
    const other = await createOpenSession();
    await Session.updateOne({ code: session.code }, { status: 'closed' });

    const res = await join(session.code, 'Intruso', other.auth.token);

    expect(res.status).toBe(404);
    expect(await res.text()).toBe('Session not found');
  });
});

describe('checking a share code before joining', () => {
  it('reports an open session as available', async () => {
    const session = await createOpenSession();

    const res = await availability(session.code);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ available: true });
  });

  it('answers an unknown code and a closed session identically', async () => {
    const session = await createOpenSession();
    await Session.updateOne({ code: session.code }, { status: 'closed' });

    const closed = await availability(session.code);
    const unknown = await availability('ABCDEFGH');

    expect(closed.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(await closed.json()).toEqual({ available: false });
    expect(await unknown.json()).toEqual({ available: false });
  });
});

describe('guessing share codes', () => {
  it('throttles a caller after 30 attempts in the window', async () => {
    const attempts = [];
    for (let attempt = 0; attempt < 30; attempt++)
      attempts.push((await join('ABCDEFGH', 'Mallory')).status);

    expect(attempts).toEqual(Array(30).fill(404));

    const res = await join('ABCDEFGH', 'Mallory');

    expect(res.status).toBe(429);
    expect(await res.text()).toBe(
      'Too many join attempts. Try again in a minute.',
    );
  });

  it('keeps a throttled caller out of a code that does exist', async () => {
    const session = await createOpenSession();
    for (let attempt = 0; attempt < 30; attempt++)
      await join('ABCDEFGH', 'Mallory');

    const res = await join(session.code, 'Mallory');

    expect(res.status).toBe(429);
    expect(await storedParticipants(session.id)).toHaveLength(1);
  });

  it('meters availability checks against their own budget', async () => {
    for (let attempt = 0; attempt < 60; attempt++)
      await availability('ABCDEFGH');

    const throttled = await availability('ABCDEFGH');

    expect(throttled.status).toBe(429);
    expect(await throttled.text()).toBe(
      'Too many join attempts. Try again in a minute.',
    );

    const session = await createOpenSession();
    const joined = await join(session.code, 'Marta');

    expect(joined.status).toBe(200);
  });
});
