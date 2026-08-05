import { describe, expect, it } from 'bun:test';
import type { Types } from 'mongoose';
import { hashToken } from '../src/modules/auth/service';
import { findSessionByDeviceTokenHash } from '../src/plugins/auth';
import { Session } from '../src/schemas';

const OWNER_HASH = hashToken('owner-token-abc');
const GUEST_HASH = hashToken('guest-token-xyz');

function seedSession() {
  return Session.create({
    status: 'draft',
    participants: [
      { name: 'Ana', deviceTokenHash: OWNER_HASH, isOwner: true },
      { name: 'Bea', deviceTokenHash: GUEST_HASH, isOwner: false },
    ],
  });
}

function stored(_id: Types.ObjectId) {
  return Session.collection.findOne({ _id });
}

describe('participants.deviceTokenHash', () => {
  it('does not travel on a normal read, even though it is stored', async () => {
    const created = await seedSession();

    const loaded = await Session.findById(created._id);

    expect(loaded?.participants).toHaveLength(2);
    expect(loaded?.participants[0]?.deviceTokenHash).toBeUndefined();
    expect(loaded?.participants[1]?.deviceTokenHash).toBeUndefined();

    const raw = await stored(created._id);
    expect(raw?.participants[0].deviceTokenHash).toBe(OWNER_HASH);
    expect(raw?.participants[1].deviceTokenHash).toBe(GUEST_HASH);
  });

  it('comes back with the query the macro runs', async () => {
    const created = await seedSession();

    const found = await findSessionByDeviceTokenHash(GUEST_HASH);

    expect(found?._id).toEqual(created._id);
    const participant = found?.participants.find(
      (candidate) => candidate.deviceTokenHash === GUEST_HASH,
    );
    expect(participant).toBeDefined();
    expect(participant?.isOwner).toBe(false);
  });

  it('resolves no session for an unknown hash', async () => {
    await seedSession();

    expect(await findSessionByDeviceTokenHash(hashToken('nope'))).toBeNull();
  });
});

describe('session collection indexes', () => {
  it('are exactly the ones declared in the schema', async () => {
    await Session.syncIndexes();

    const indexes = await Session.collection.indexes();
    const byKey = new Map(
      indexes.map((index) => [JSON.stringify(index.key), index]),
    );

    expect([...byKey.keys()].sort()).toEqual([
      '{"_id":1}',
      '{"code":1}',
      '{"createdAt":1}',
      '{"participants.deviceTokenHash":1}',
    ]);

    expect(byKey.get('{"code":1}')).toMatchObject({
      unique: true,
      partialFilterExpression: { code: { $type: 'string' } },
    });
    expect(byKey.get('{"createdAt":1}')?.expireAfterSeconds).toBe(
      90 * 24 * 3600,
    );
  });
});
