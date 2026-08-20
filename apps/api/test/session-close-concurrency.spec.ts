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
  lineItems: { id: string }[];
  auth: { token: string };
};

async function fullyClaimedSession() {
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
  const session = { ...open, id: draft.id, token: draft.auth.token };
  expect((await setClaim(session, 3)).status).toBe(200);
  return session;
}

function setClaim(
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
  })) as unknown as {
    status: string;
    closedAt?: Date;
    lineItems: { quantity: number; claims: { units: number }[] }[];
  } | null;
}

describe('closing the same session twice at once', () => {
  it('closes once and refuses the loser', async () => {
    const session = await fullyClaimedSession();

    const [first, second] = await Promise.all([close(session), close(session)]);

    expect([first.status, second.status].sort()).toEqual([200, 409]);

    const [won, lost] =
      first.status === 200 ? [first, second] : [second, first];
    const closed = (await won.json()) as { status: string; closedAt: string };
    expect(closed.status).toBe('closed');
    expect(await lost.text()).toBe('Session is not open');

    const stored = await storedSession(session.id);
    expect(stored?.status).toBe('closed');
    expect(stored?.closedAt?.toISOString()).toBe(closed.closedAt);
  });
});

describe('closing while a claim is being released', () => {
  it('never stores a closed session with unassigned units', async () => {
    const session = await fullyClaimedSession();

    const [closeRes, releaseRes] = await Promise.all([
      close(session),
      setClaim(session, 0),
    ]);

    const stored = await storedSession(session.id);
    if (!stored) throw new Error('session vanished');

    const unassigned = stored.lineItems.some(
      (item) =>
        item.claims.reduce((sum, claim) => sum + claim.units, 0) <
        item.quantity,
    );

    if (closeRes.status === 200) {
      expect(stored.status).toBe('closed');
      expect(unassigned).toBe(false);
      expect(releaseRes.status).toBe(409);
      expect(await releaseRes.text()).toBe('Session is not open');
    } else {
      expect(closeRes.status).toBe(409);
      expect(stored.status).toBe('open');
    }
  });
});
