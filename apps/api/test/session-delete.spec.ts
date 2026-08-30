import { describe, expect, it } from 'bun:test';
import { Types } from 'mongoose';
import { hashToken } from '../src/modules/auth/service';
import { receiptFileId } from '../src/modules/receipt/service';
import { createSessionModule } from '../src/modules/session';
import { SessionService } from '../src/modules/session/service';
import { Session } from '../src/schemas';
import { analyzeRequest, fakeExtract } from './fixtures';
import { receiptExists, storedReceipts, testStorage } from './setup';

const app = createSessionModule(new SessionService(fakeExtract, testStorage()));

const GUEST_TOKEN = 'guest-token-xyz';

type Draft = { id: string; auth: { participantId: string; token: string } };

async function createDraft() {
  const res = await app.handle(analyzeRequest());
  expect(res.status).toBe(200);
  return (await res.json()) as Draft;
}

function deleteSession(sessionId: string, authorization?: string) {
  return app.handle(
    new Request(`http://localhost/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: authorization ? { authorization } : {},
    }),
  );
}

function getSession(sessionId: string, authorization: string) {
  return app.handle(
    new Request(`http://localhost/sessions/${sessionId}`, {
      headers: { authorization },
    }),
  );
}

function stored(sessionId: string) {
  return Session.collection.findOne({ _id: new Types.ObjectId(sessionId) });
}

async function receiptKey(sessionId: string) {
  const raw = await stored(sessionId);
  const key = receiptFileId(raw?.receiptImageUrl ?? '');
  if (!key) throw new Error(`session ${sessionId} has no receipt image`);
  return key;
}

function addGuest(sessionId: string) {
  return Session.updateOne(
    { _id: new Types.ObjectId(sessionId) },
    {
      $push: {
        participants: {
          name: 'Bea',
          deviceTokenHash: hashToken(GUEST_TOKEN),
          isOwner: false,
        },
      },
    },
  );
}

describe('DELETE /sessions/:sessionId', () => {
  it('drops the session and its receipt image for good', async () => {
    const draft = await createDraft();
    const key = await receiptKey(draft.id);
    expect(await receiptExists(key)).toBe(true);

    const res = await deleteSession(draft.id, `Bearer ${draft.auth.token}`);

    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');
    expect(await stored(draft.id)).toBeNull();
    expect(await receiptExists(key)).toBe(false);
    expect(await storedReceipts()).toEqual([]);
  });

  it('leaves the owner token pointing at nothing', async () => {
    const draft = await createDraft();
    const authorization = `Bearer ${draft.auth.token}`;

    expect((await deleteSession(draft.id, authorization)).status).toBe(204);

    const res = await getSession(draft.id, authorization);

    expect(res.status).toBe(401);
    expect(await res.text()).toBe('Unauthorized');
  });

  it('answers 401 to a repeated delete, the session being gone', async () => {
    const draft = await createDraft();
    const authorization = `Bearer ${draft.auth.token}`;
    expect((await deleteSession(draft.id, authorization)).status).toBe(204);

    const res = await deleteSession(draft.id, authorization);

    expect(res.status).toBe(401);
  });

  it('refuses a guest and keeps both the session and the image', async () => {
    const draft = await createDraft();
    await addGuest(draft.id);
    const key = await receiptKey(draft.id);

    const res = await deleteSession(draft.id, `Bearer ${GUEST_TOKEN}`);

    expect(res.status).toBe(403);
    expect(await res.text()).toBe('Forbidden');
    expect(await stored(draft.id)).not.toBeNull();
    expect(await receiptExists(key)).toBe(true);
  });

  it('refuses a token from another session and touches neither', async () => {
    const mine = await createDraft();
    const other = await createDraft();

    const res = await deleteSession(other.id, `Bearer ${mine.auth.token}`);

    expect(res.status).toBe(403);
    expect(await stored(mine.id)).not.toBeNull();
    expect(await stored(other.id)).not.toBeNull();
    expect(await storedReceipts()).toHaveLength(2);
  });

  it('refuses an unauthenticated delete', async () => {
    const draft = await createDraft();
    const key = await receiptKey(draft.id);

    const res = await deleteSession(draft.id);

    expect(res.status).toBe(401);
    expect(await stored(draft.id)).not.toBeNull();
    expect(await receiptExists(key)).toBe(true);
  });

  it('refuses a token that no session carries', async () => {
    const draft = await createDraft();

    const res = await deleteSession(draft.id, 'Bearer no-existe');

    expect(res.status).toBe(401);
    expect(await stored(draft.id)).not.toBeNull();
  });

  it('deletes a session that never got an image', async () => {
    const token = 'owner-token-abc';
    const session = await Session.create({
      status: 'draft',
      participants: [
        { name: 'Ana', deviceTokenHash: hashToken(token), isOwner: true },
      ],
    });

    const res = await deleteSession(String(session._id), `Bearer ${token}`);

    expect(res.status).toBe(204);
    expect(await stored(String(session._id))).toBeNull();
    expect(await storedReceipts()).toEqual([]);
  });
});
