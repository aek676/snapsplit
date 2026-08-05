import { describe, expect, it } from 'bun:test';
import { Types } from 'mongoose';
import { hashToken } from '../src/modules/auth/service';
import { createSessionModule } from '../src/modules/session';
import { SessionService } from '../src/modules/session/service';
import { Session } from '../src/schemas';
import { analyzeRequest, fakeExtract, fakeStorage } from './fixtures';

const app = createSessionModule(new SessionService(fakeExtract, fakeStorage()));

type Draft = { id: string; auth: { participantId: string; token: string } };

async function createDraft() {
  const res = await app.handle(analyzeRequest());
  expect(res.status).toBe(200);
  return (await res.json()) as Draft;
}

function getSession(sessionId: string, authorization?: string) {
  return app.handle(
    new Request(`http://localhost/sessions/${sessionId}`, {
      headers: authorization ? { authorization } : {},
    }),
  );
}

describe('full thread: /analyze issues a token that opens its session', () => {
  it('stores the hash of the issued token, never the token itself', async () => {
    const draft = await createDraft();

    const raw = await Session.collection.findOne({
      _id: new Types.ObjectId(draft.id),
    });

    expect(raw?.participants).toHaveLength(1);
    expect(raw?.participants[0].isOwner).toBe(true);
    expect(raw?.participants[0].deviceTokenHash).toBe(
      hashToken(draft.auth.token),
    );
    expect(JSON.stringify(raw)).not.toContain(draft.auth.token);
  });

  it('returns 200 without leaking the token in the view', async () => {
    const draft = await createDraft();

    const res = await getSession(draft.id, `Bearer ${draft.auth.token}`);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ id: draft.id, status: 'draft' });
    expect(JSON.stringify(body)).not.toContain(draft.auth.token);
    expect(body).not.toHaveProperty('auth');
    expect(body).not.toHaveProperty('participants');
  });

  it('lets the owner edit the draft line items', async () => {
    const draft = await createDraft();

    const res = await app.handle(
      new Request(`http://localhost/sessions/${draft.id}/line-items`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${draft.auth.token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Tapa',
          quantity: 1,
          unitPriceCents: 350,
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ totalCents: 950 });

    const raw = await Session.collection.findOne({
      _id: new Types.ObjectId(draft.id),
    });
    expect(raw?.participants[0].deviceTokenHash).toBe(
      hashToken(draft.auth.token),
    );
  });

  it('returns 401 without a header', async () => {
    const draft = await createDraft();

    const res = await getSession(draft.id);

    expect(res.status).toBe(401);
    expect(await res.text()).toBe('Unauthorized');
  });

  it('returns 401 for a token that does not exist in the database', async () => {
    const draft = await createDraft();

    const res = await getSession(draft.id, 'Bearer no-existe');

    expect(res.status).toBe(401);
  });

  it('returns 403 with another session token', async () => {
    const mine = await createDraft();
    const other = await createDraft();

    const res = await getSession(other.id, `Bearer ${mine.auth.token}`);

    expect(res.status).toBe(403);
    expect(await res.text()).toBe('Forbidden');
  });
});
