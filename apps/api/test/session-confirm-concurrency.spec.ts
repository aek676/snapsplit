import { beforeAll, describe, expect, it } from 'bun:test';
import { Types } from 'mongoose';
import { createSessionModule } from '../src/modules/session';
import { SessionService } from '../src/modules/session/service';
import { Session } from '../src/schemas';
import { analyzeRequest, fakeExtract } from './fixtures';
import { testStorage } from './setup';

/**
 * Confirm publishes with a conditional update keyed on `status: 'draft'`, so
 * two requests racing over the same draft cannot both win: whatever code a
 * caller is handed is the one that ended up stored.
 */

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

async function storedSession(sessionId: string) {
  return (await Session.collection.findOne({
    _id: new Types.ObjectId(sessionId),
  })) as unknown as { status: string; code?: string } | null;
}

beforeAll(async () => {
  await Session.syncIndexes();
});

describe('confirming the same draft twice at once', () => {
  it('publishes once and refuses the loser', async () => {
    const draft = await createDraft();

    const [first, second] = await Promise.all([confirm(draft), confirm(draft)]);

    expect([first.status, second.status].sort()).toEqual([200, 409]);

    const [won, lost] =
      first.status === 200 ? [first, second] : [second, first];
    const published = (await won.json()) as { status: string; code: string };
    expect(published.status).toBe('open');
    expect(await lost.text()).toBe('Session is not editable');

    const stored = await storedSession(draft.id);
    expect(stored?.status).toBe('open');
    expect(stored?.code).toBe(published.code);
  });
});
