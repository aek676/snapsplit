import { afterEach, beforeAll, describe, expect, it, spyOn } from 'bun:test';
import { Types } from 'mongoose';
import { createSessionModule } from '../src/modules/session';
import { SessionService } from '../src/modules/session/service';
import { Session } from '../src/schemas';
import { analyzeRequest, fakeExtract } from './fixtures';
import { testStorage } from './setup';

const CODE_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;
/** Bytes of 0 always land on the alphabet's first letter. */
const COLLIDING_CODE = 'AAAAAAAA';

const spies: { mockRestore: () => void }[] = [];

const app = createSessionModule(new SessionService(fakeExtract, testStorage()));

type Draft = { id: string; auth: { token: string } };

async function createDraft() {
  const res = await app.handle(analyzeRequest());
  expect(res.status).toBe(200);
  return (await res.json()) as Draft;
}

function confirm(draft: Draft) {
  return app.handle(
    new Request(`http://localhost/sessions/${draft.id}/confirm`, {
      method: 'POST',
      headers: { authorization: `Bearer ${draft.auth.token}` },
    }),
  );
}

function scriptCodeDraws(...bytes: number[]) {
  let call = 0;
  const spy = spyOn(crypto, 'getRandomValues').mockImplementation(
    <T extends ArrayBufferView | null>(array: T): T => {
      const byte = bytes[Math.min(call++, bytes.length - 1)];
      if (array)
        new Uint8Array(array.buffer, array.byteOffset, array.byteLength).fill(
          byte,
        );
      return array;
    },
  );
  spies.push(spy);
  return spy;
}

async function storedSession(sessionId: string) {
  return (await Session.collection.findOne({
    _id: new Types.ObjectId(sessionId),
  })) as unknown as { status: string; code?: string } | null;
}

beforeAll(async () => {
  await Session.syncIndexes();
});

afterEach(() => {
  for (const spy of spies.splice(0).reverse()) spy.mockRestore();
});

describe('confirming when the drawn code is already taken', () => {
  it('retries past the collision and publishes with a fresh code', async () => {
    const first = await createDraft();
    const second = await createDraft();

    scriptCodeDraws(0);
    expect((await confirm(first)).status).toBe(200);

    scriptCodeDraws(0, 1);
    const res = await confirm(second);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; code: string };
    expect(body.status).toBe('open');
    expect(body.code).toMatch(CODE_PATTERN);
    expect(body.code).not.toBe(COLLIDING_CODE);

    const [storedFirst, storedSecond] = await Promise.all([
      storedSession(first.id),
      storedSession(second.id),
    ]);
    expect(storedFirst?.code).toBe(COLLIDING_CODE);
    expect(storedSecond?.status).toBe('open');
    expect(storedSecond?.code).toBe(body.code);
  });

  it('gives up after every attempt draws the taken code', async () => {
    const first = await createDraft();
    const second = await createDraft();

    scriptCodeDraws(0);
    expect((await confirm(first)).status).toBe(200);

    spies.push(spyOn(console, 'error').mockImplementation(() => {}));
    scriptCodeDraws(0);
    const res = await confirm(second);

    expect(res.status).toBe(500);
    expect(await res.text()).toBe('Failed to generate a session code');

    const stored = await storedSession(second.id);
    expect(stored?.status).toBe('draft');
    expect(stored?.code).toBeUndefined();
    expect(
      await Session.collection.countDocuments({ code: COLLIDING_CODE }),
    ).toBe(1);
  });
});
