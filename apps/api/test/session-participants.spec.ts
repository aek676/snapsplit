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

/** Lee el documento por el driver, saltándose las proyecciones de mongoose. */
function stored(_id: Types.ObjectId) {
  return Session.collection.findOne({ _id });
}

describe('participants.deviceTokenHash', () => {
  it('no viaja en una lectura normal, aunque esté guardado', async () => {
    const created = await seedSession();

    const loaded = await Session.findById(created._id);

    expect(loaded?.participants).toHaveLength(2);
    expect(loaded?.participants[0]?.deviceTokenHash).toBeUndefined();
    expect(loaded?.participants[1]?.deviceTokenHash).toBeUndefined();

    const raw = await stored(created._id);
    expect(raw?.participants[0].deviceTokenHash).toBe(OWNER_HASH);
    expect(raw?.participants[1].deviceTokenHash).toBe(GUEST_HASH);
  });

  it('vuelve con la query que ejecuta el macro', async () => {
    const created = await seedSession();

    const found = await findSessionByDeviceTokenHash(GUEST_HASH);

    expect(found?._id).toEqual(created._id);
    const participant = found?.participants.find(
      (candidate) => candidate.deviceTokenHash === GUEST_HASH,
    );
    expect(participant).toBeDefined();
    expect(participant?.isOwner).toBe(false);
  });

  it('no resuelve ninguna sesión para un hash desconocido', async () => {
    await seedSession();

    expect(await findSessionByDeviceTokenHash(hashToken('nope'))).toBeNull();
  });
});

describe('mutar participants sobre un documento sin la proyección', () => {
  // `loaded.participants = [...]` no compila: TypeScript exige un DocumentArray
  // y no acepta el array plano que devuelve `.filter()`. Pero `.set()` sí pasa,
  // igual que cualquier `as never`, y es por donde entra el footgun de verdad.
  it('reasignar el array borra la credencial de los supervivientes', async () => {
    const created = await seedSession();
    const loaded = await Session.findById(created._id);
    if (!loaded) throw new Error('la sesión sembrada no se pudo leer');

    loaded.set(
      'participants',
      loaded.participants.filter((participant) => participant.isOwner),
    );
    await loaded.save();

    const raw = await stored(created._id);
    expect(raw?.participants).toHaveLength(1);
    expect(raw?.participants[0].isOwner).toBe(true);
    expect(raw?.participants[0].deviceTokenHash).toBeUndefined();
  });

  it('.pull() conserva la credencial del resto', async () => {
    const created = await seedSession();
    const loaded = await Session.findById(created._id);
    const guest = loaded?.participants.find(
      (participant) => !participant.isOwner,
    );
    if (!loaded || !guest)
      throw new Error('la sesión sembrada no se pudo leer');

    loaded.participants.pull(guest._id);
    await loaded.save();

    const raw = await stored(created._id);
    expect(raw?.participants).toHaveLength(1);
    expect(raw?.participants[0].isOwner).toBe(true);
    expect(raw?.participants[0].deviceTokenHash).toBe(OWNER_HASH);
  });
});

describe('índices de la colección de sesiones', () => {
  it('son exactamente los declarados en el schema', async () => {
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
    // El monitor de TTL de mongod corre cada 60 s: se afirma que el índice
    // existe, nunca que expire.
    expect(byKey.get('{"createdAt":1}')?.expireAfterSeconds).toBe(
      90 * 24 * 3600,
    );
  });
});
