import { beforeAll, describe, expect, it } from 'bun:test';
import { Types } from 'mongoose';
import { createSessionModule } from '../src/modules/session';
import { SessionService } from '../src/modules/session/service';
import { Session } from '../src/schemas';
import { analyzeRequest, fakeExtract } from './fixtures';
import { testStorage } from './setup';

/**
 * Claims write through a compare-and-swap keyed on `__v` and `status: 'open'`,
 * so two participants racing over the last units of a line cannot both win,
 * while claims that fit together all survive the race.
 */

const app = createSessionModule(new SessionService(fakeExtract, testStorage()));

type SessionView = {
  id: string;
  code: string;
  lineItems: { id: string }[];
  auth: { token: string };
};

async function openSessionWithGuests() {
  const draftRes = await app.handle(analyzeRequest());
  expect(draftRes.status).toBe(200);
  const draft = (await draftRes.json()) as SessionView;

  const confirmRes = await app.handle(
    new Request(`http://localhost/sessions/${draft.id}/confirm`, {
      method: 'POST',
      headers: { authorization: `Bearer ${draft.auth.token}` },
    }),
  );
  expect(confirmRes.status).toBe(200);
  const open = (await confirmRes.json()) as SessionView;

  const guests = [];
  for (const name of ['Ana', 'Luis']) {
    const joinRes = await app.handle(
      new Request(`http://localhost/sessions/join/${open.code}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name }),
      }),
    );
    expect(joinRes.status).toBe(200);
    guests.push((await joinRes.json()) as SessionView);
  }

  return { id: draft.id, lineItemId: open.lineItems[0].id, guests };
}

function claim(
  sessionId: string,
  lineItemId: string,
  token: string,
  units: number,
) {
  return app.handle(
    new Request(
      `http://localhost/sessions/${sessionId}/line-items/${lineItemId}/claim`,
      {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ units }),
      },
    ),
  );
}

async function storedClaims(sessionId: string) {
  const stored = (await Session.collection.findOne({
    _id: new Types.ObjectId(sessionId),
  })) as unknown as {
    lineItems: { claims: { participantId: unknown; units: number }[] }[];
  } | null;
  return stored?.lineItems[0].claims ?? [];
}

beforeAll(async () => {
  await Session.syncIndexes();
});

describe('two guests racing for the last units of a line', () => {
  it('lets exactly one of them win', async () => {
    const { id, lineItemId, guests } = await openSessionWithGuests();
    const [ana, luis] = guests;

    // The line has 3 units; two claims of 2 cannot both fit.
    const [first, second] = await Promise.all([
      claim(id, lineItemId, ana.auth.token, 2),
      claim(id, lineItemId, luis.auth.token, 2),
    ]);

    expect([first.status, second.status].sort()).toEqual([200, 409]);
    const loser = first.status === 409 ? first : second;
    expect(await loser.text()).toBe('Not enough units available');

    const claims = await storedClaims(id);
    expect(claims).toHaveLength(1);
    expect(claims[0].units).toBe(2);
  });
});

describe('two guests racing with claims that fit together', () => {
  it('persists both after the loser retries', async () => {
    const { id, lineItemId, guests } = await openSessionWithGuests();
    const [ana, luis] = guests;

    const [first, second] = await Promise.all([
      claim(id, lineItemId, ana.auth.token, 2),
      claim(id, lineItemId, luis.auth.token, 1),
    ]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const claims = await storedClaims(id);
    expect(claims.map((entry) => entry.units).sort()).toEqual([1, 2]);
  });
});

describe('one guest lowering a claim while another raises theirs', () => {
  it('lets the increase land once the decrease frees units', async () => {
    const { id, lineItemId, guests } = await openSessionWithGuests();
    const [ana, luis] = guests;

    expect((await claim(id, lineItemId, ana.auth.token, 2)).status).toBe(200);

    let [decrease, increase] = await Promise.all([
      claim(id, lineItemId, ana.auth.token, 1),
      claim(id, lineItemId, luis.auth.token, 2),
    ]);

    expect(decrease.status).toBe(200);

    // The increase may read a snapshot from before the decrease landed and
    // 409; after the decrease is durable a retry must succeed.
    if (increase.status === 409)
      increase = await claim(id, lineItemId, luis.auth.token, 2);
    expect(increase.status).toBe(200);

    const claims = await storedClaims(id);
    expect(claims.map((entry) => entry.units).sort()).toEqual([1, 2]);
  });
});

describe('reclaiming with an absolute unit count', () => {
  it('replaces the previous claim and frees units at zero', async () => {
    const { id, lineItemId, guests } = await openSessionWithGuests();
    const [ana] = guests;

    expect((await claim(id, lineItemId, ana.auth.token, 3)).status).toBe(200);
    expect((await claim(id, lineItemId, ana.auth.token, 1)).status).toBe(200);
    expect(await storedClaims(id)).toHaveLength(1);
    expect((await storedClaims(id))[0].units).toBe(1);

    expect((await claim(id, lineItemId, ana.auth.token, 0)).status).toBe(200);
    expect(await storedClaims(id)).toHaveLength(0);
  });
});
