import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  spyOn,
} from 'bun:test';
import type { HydratedDocument } from 'mongoose';
import type { ExtractedReceipt, ExtractReceipt } from '../../../ai/receipt';
import { Session } from '../../../schemas';
import type { ObjectStorage } from '../../../storage/object-storage';
import { hashToken } from '../../auth/service';
import type { SessionModel } from '../model';
import {
  buildDraftPayload,
  generateSessionCode,
  lineSumCents,
  SessionService,
  toSessionView,
} from '../service';

const deviceTokenHash = hashToken('device-token-abc');

const extracted: ExtractedReceipt = {
  merchant: 'Bar Paco',
  date: '2026-07-07',
  currency: 'EUR',
  totalCents: 4230,
  lineItems: [
    {
      name: 'Caña',
      quantity: 3,
      unitPriceCents: 200,
      lineTotalCents: 600,
      aiConfidence: 0.94,
    },
    {
      name: 'Tapa',
      quantity: 1,
      unitPriceCents: 350,
      lineTotalCents: 350,
      aiConfidence: 0.4,
    },
  ],
};

describe('buildDraftPayload', () => {
  it('maps an extracted receipt into a draft session payload', () => {
    const payload = buildDraftPayload(
      deviceTokenHash,
      extracted,
      '/receipts/abc.jpg',
    );

    expect(payload.status).toBe('draft');
    expect(payload.merchant).toBe('Bar Paco');
    expect(payload.currency).toBe('EUR');
    expect(payload.totalCents).toBe(4230);
    expect(payload.receiptImageUrl).toBe('/receipts/abc.jpg');
    expect(payload.date).toEqual(new Date('2026-07-07'));
    expect(payload.lineItems).toHaveLength(2);
    expect(payload.lineItems[0]).toMatchObject({
      name: 'Caña',
      quantity: 3,
      aiConfidence: 0.94,
    });

    expect(payload.participants).toEqual([{ deviceTokenHash, isOwner: true }]);
  });

  it('tolerates a null merchant/date', () => {
    const payload = buildDraftPayload(
      deviceTokenHash,
      { ...extracted, merchant: null, date: null },
      '/receipts/x.png',
    );

    expect(payload.merchant).toBeUndefined();
    expect(payload.date).toBeUndefined();
  });
});

describe('toSessionView', () => {
  it('serializes a session document to the plain API view', () => {
    const payload = buildDraftPayload(
      deviceTokenHash,
      extracted,
      '/receipts/abc.jpg',
    );
    const doc = new Session(payload);

    const view = toSessionView(doc);

    expect(view.id).toBe(String(doc._id));
    expect(view.code).toBeNull();
    expect(view.status).toBe('draft');
    expect(view.merchant).toBe('Bar Paco');
    expect(view.receiptImageUrl).toBe('/receipts/abc.jpg');
    expect(view.date).toBe('2026-07-07');
    expect(view.lineItems).toHaveLength(2);
    expect(view.lineItems[1]).toMatchObject({
      name: 'Tapa',
      lineTotalCents: 350,
      aiConfidence: 0.4,
    });
    expect(typeof view.lineItems[0].id).toBe('string');
  });

  it('returns null for a missing merchant and date', () => {
    const doc = new Session(
      buildDraftPayload(
        deviceTokenHash,
        { ...extracted, merchant: null, date: null },
        '/receipts/x.png',
      ),
    );
    const view = toSessionView(doc);

    expect(view.merchant).toBeNull();
    expect(view.date).toBeNull();
    expect(view.closedAt).toBeNull();
  });

  it('serializes closedAt as an ISO timestamp when set', () => {
    const doc = new Session(
      buildDraftPayload(deviceTokenHash, extracted, '/receipts/x.png'),
    );
    doc.closedAt = new Date('2026-08-19T10:00:00.000Z');

    expect(toSessionView(doc).closedAt).toBe('2026-08-19T10:00:00.000Z');
  });
});

function imageBody(
  bytes = new Uint8Array([1, 2, 3]),
  type = 'image/jpeg',
): SessionModel['analyzeBody'] {
  return { image: new File([bytes], 'receipt.jpg', { type }) };
}

function fakeStorage(overrides: Partial<ObjectStorage> = {}): ObjectStorage {
  return {
    save: mock(async () => {}),
    get: mock(async () => null),
    delete: mock(async () => {}),
    ...overrides,
  };
}

function saveCall(storage: ObjectStorage) {
  return (storage.save as ReturnType<typeof mock>).mock.calls[0] as [
    string,
    Uint8Array,
    string,
  ];
}

describe('SessionService.createDraftFromImage', () => {
  beforeEach(() => {
    spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    mock.restore();
  });

  it('extracts, stores and persists a draft, returning its view', async () => {
    let saved: HydratedDocument<Session> | undefined;
    spyOn(Session.prototype, 'save').mockImplementation(async function (
      this: HydratedDocument<Session>,
    ) {
      saved = this;
      return this;
    });
    const extract = mock<ExtractReceipt>(async () => extracted);
    const storage = fakeStorage();
    const service = new SessionService(extract, storage);

    const bytes = new Uint8Array([4, 5, 6, 7]);
    const result = await service.createDraftFromImage(
      imageBody(bytes, 'image/png'),
    );

    expect(extract).toHaveBeenCalledTimes(1);
    expect(extract.mock.calls[0][0]).toEqual(bytes);
    expect(extract.mock.calls[0][1]).toBe('image/png');
    expect(storage.save).toHaveBeenCalledTimes(1);
    const [key, storedBytes, storedMediaType] = saveCall(storage);
    expect(storedBytes).toEqual(bytes);
    expect(storedMediaType).toBe('image/png');
    expect(key).toMatch(/\.png$/);

    // The happy path returns the serialized session view, not a status error.
    expect(result).toMatchObject({
      status: 'draft',
      merchant: 'Bar Paco',
      receiptImageUrl: `/receipts/${key}`,
    });
    const created = result as SessionModel['draftSessionCreatedResponse'];
    expect(created.lineItems).toHaveLength(2);

    const owner = saved?.participants[0];
    expect(owner?.isOwner).toBe(true);
    expect(created.auth.participantId).toBe(String(owner?._id));
    expect(owner?.deviceTokenHash).not.toBe(created.auth.token);
    expect(owner?.deviceTokenHash).toBe(hashToken(created.auth.token));
  });

  it('returns 502 without storing when extraction fails', async () => {
    const saveSpy = spyOn(Session.prototype, 'save');
    const extract = mock<ExtractReceipt>(async () => {
      throw new Error('gemini exploded');
    });
    const storage = fakeStorage();
    const service = new SessionService(extract, storage);

    const result = await service.createDraftFromImage(imageBody());

    expect(result).toMatchObject({
      code: 502,
      response: 'Receipt analysis failed',
    });
    expect(storage.save).not.toHaveBeenCalled();
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('returns 500 and deletes the stored receipt when persistence fails', async () => {
    spyOn(Session.prototype, 'save').mockRejectedValue(new Error('mongo down'));
    const extract = mock<ExtractReceipt>(async () => extracted);
    const storage = fakeStorage();
    const service = new SessionService(extract, storage);

    const result = await service.createDraftFromImage(imageBody());

    expect(result).toMatchObject({
      code: 500,
      response: 'Failed to create draft session',
    });
    expect(storage.delete).toHaveBeenCalledWith(saveCall(storage)[0]);
  });
});

function draftSession() {
  return new Session(
    buildDraftPayload(deviceTokenHash, extracted, '/receipts/abc.jpg'),
  );
}

function sessionService() {
  return new SessionService(
    mock<ExtractReceipt>(async () => extracted),
    fakeStorage(),
  );
}

describe('SessionService.deleteSession', () => {
  beforeEach(() => {
    spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    mock.restore();
  });

  it('deletes the document and its stored receipt image', async () => {
    const deleteOne = spyOn(Session.prototype, 'deleteOne').mockImplementation(
      (async () => ({ deletedCount: 1 })) as never,
    );
    const storage = fakeStorage();
    const session = draftSession();

    const result = await new SessionService(
      mock<ExtractReceipt>(async () => extracted),
      storage,
    ).deleteSession(session);

    expect(deleteOne).toHaveBeenCalledTimes(1);
    expect(storage.delete).toHaveBeenCalledWith('abc.jpg');
    expect(result).toMatchObject({ code: 204 });
  });

  it('skips the storage call when there is no receipt image', async () => {
    spyOn(Session.prototype, 'deleteOne').mockImplementation((async () => ({
      deletedCount: 1,
    })) as never);
    const storage = fakeStorage();
    const session = draftSession();
    session.receiptImageUrl = '';

    await new SessionService(
      mock<ExtractReceipt>(async () => extracted),
      storage,
    ).deleteSession(session);

    expect(storage.delete).not.toHaveBeenCalled();
  });

  it('still succeeds when deleting the stored image fails', async () => {
    const deleteOne = spyOn(Session.prototype, 'deleteOne').mockImplementation(
      (async () => ({ deletedCount: 1 })) as never,
    );
    const storage = fakeStorage({
      delete: mock(async () => {
        throw new Error('storage down');
      }),
    });

    const result = await new SessionService(
      mock<ExtractReceipt>(async () => extracted),
      storage,
    ).deleteSession(draftSession());

    expect(deleteOne).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ code: 204 });
  });
});

describe('SessionService.updateSession', () => {
  beforeEach(() => {
    spyOn(console, 'error').mockImplementation(() => {});
    spyOn(Session.prototype, 'save').mockImplementation(async function (
      this: unknown,
    ) {
      return this;
    });
  });

  afterEach(() => {
    mock.restore();
  });

  it('corrects a total the AI misread off the receipt', async () => {
    const session = draftSession();

    const result = (await sessionService().updateSession(session, {
      totalCents: 950,
    })) as SessionModel['draftSessionResponse'];

    expect(result.totalCents).toBe(950);
    expect(result.lineItems).toHaveLength(2);
  });

  it('corrects the merchant and the date', async () => {
    const session = draftSession();

    const result = (await sessionService().updateSession(session, {
      merchant: 'Bar Pepe',
      date: '2026-07-08',
    })) as SessionModel['draftSessionResponse'];

    expect(result.merchant).toBe('Bar Pepe');
    expect(result.date).toBe('2026-07-08');
    expect(result.totalCents).toBe(4230);
  });

  it('leaves everything untouched for an empty patch', async () => {
    const session = draftSession();

    const result = (await sessionService().updateSession(
      session,
      {},
    )) as SessionModel['draftSessionResponse'];

    expect(result).toMatchObject({
      merchant: 'Bar Paco',
      date: '2026-07-07',
      totalCents: 4230,
    });
  });

  it('returns 409 when the session is not a draft', async () => {
    const session = draftSession();
    session.status = 'open';

    const result = await sessionService().updateSession(session, {
      totalCents: 950,
    });

    expect(result).toMatchObject({
      code: 409,
      response: 'Session is not editable',
    });
    expect(session.totalCents).toBe(4230);
  });

  it('adopts the items sum when the owner hands the total over', async () => {
    const session = draftSession();

    const result = (await sessionService().updateSession(session, {
      totalSource: 'items',
    })) as SessionModel['draftSessionResponse'];

    expect(result.totalSource).toBe('items');
    expect(result.totalCents).toBe(950);
  });

  it('returns 409 when the patch both fixes and hands over the total', async () => {
    const session = draftSession();

    const result = await sessionService().updateSession(session, {
      totalCents: 1200,
      totalSource: 'items',
    });

    expect(result).toMatchObject({
      code: 409,
      response: 'Cannot set a total while it follows the items',
    });
    expect(session.totalCents).toBe(4230);
    expect(session.totalSource).toBe('receipt');
  });

  it('goes back to a fixed total when the owner types one in', async () => {
    const session = draftSession();
    session.totalSource = 'items';

    const result = (await sessionService().updateSession(session, {
      totalCents: 1200,
    })) as SessionModel['draftSessionResponse'];

    expect(result.totalSource).toBe('receipt');
    expect(result.totalCents).toBe(1200);
  });
});

describe('a total handed over to the items', () => {
  beforeEach(() => {
    spyOn(console, 'error').mockImplementation(() => {});
    spyOn(Session.prototype, 'save').mockImplementation(async function (
      this: unknown,
    ) {
      return this;
    });
  });

  afterEach(() => {
    mock.restore();
  });

  function followingSession() {
    const session = draftSession();
    session.totalSource = 'items';
    session.totalCents = 950;
    return session;
  }

  it('follows an added line', async () => {
    const session = followingSession();

    const result = (await sessionService().addLineItem(session, {
      name: 'Vino',
      quantity: 2,
      unitPriceCents: 300,
    })) as SessionModel['draftSessionResponse'];

    expect(result.totalCents).toBe(1550);
  });

  it('follows an edited line', async () => {
    const session = followingSession();
    const id = String(session.lineItems[0]._id);

    const result = (await sessionService().updateLineItem(session, id, {
      quantity: 5,
    })) as SessionModel['draftSessionResponse'];

    expect(result.totalCents).toBe(1350);
  });

  it('follows a deleted line', async () => {
    const session = followingSession();
    const id = String(session.lineItems[0]._id);

    const result = (await sessionService().deleteLineItem(
      session,
      id,
    )) as SessionModel['draftSessionResponse'];

    expect(result.totalCents).toBe(350);
  });

  it('never trips the confirm gate', async () => {
    const session = followingSession();
    for (const item of session.lineItems) item.aiConfidence = 1;
    mockPublish(session);

    await sessionService().addLineItem(session, {
      name: 'Vino',
      quantity: 2,
      unitPriceCents: 300,
    });
    const result = (await sessionService().confirmSession(
      session,
    )) as SessionModel['draftSessionResponse'];

    expect(result.status).toBe('open');
  });
});

describe('SessionService.addLineItem', () => {
  beforeEach(() => {
    spyOn(console, 'error').mockImplementation(() => {});
    spyOn(Session.prototype, 'save').mockImplementation(async function (
      this: unknown,
    ) {
      return this;
    });
  });

  afterEach(() => {
    mock.restore();
  });

  it('appends a hand-entered line with a computed total and full confidence', async () => {
    const session = draftSession();

    const result = (await sessionService().addLineItem(session, {
      name: 'Vino',
      quantity: 2,
      unitPriceCents: 300,
    })) as SessionModel['draftSessionResponse'];

    expect(session.lineItems).toHaveLength(3);
    expect(result.lineItems[2]).toMatchObject({
      name: 'Vino',
      quantity: 2,
      unitPriceCents: 300,
      lineTotalCents: 600,
      aiConfidence: 1,
    });
  });

  it('leaves the receipt total where the owner can still reach it', async () => {
    const session = draftSession();

    const result = (await sessionService().addLineItem(session, {
      name: 'Vino',
      quantity: 2,
      unitPriceCents: 300,
    })) as SessionModel['draftSessionResponse'];

    // The missing line brings the items up to the printed total, it does not
    // push the target further away.
    expect(result.totalCents).toBe(4230);
    expect(lineSumCents(session)).toBe(1550);
  });

  it('returns 409 when the session is not a draft', async () => {
    const session = draftSession();
    session.status = 'open';

    const result = await sessionService().addLineItem(session, {
      name: 'Vino',
      quantity: 1,
      unitPriceCents: 100,
    });

    expect(result).toMatchObject({
      code: 409,
      response: 'Session is not editable',
    });
  });
});

describe('SessionService.updateLineItem', () => {
  beforeEach(() => {
    spyOn(console, 'error').mockImplementation(() => {});
    spyOn(Session.prototype, 'save').mockImplementation(async function (
      this: unknown,
    ) {
      return this;
    });
  });

  afterEach(() => {
    mock.restore();
  });

  it('recomputes the line total when quantity changes', async () => {
    const session = draftSession();
    const id = String(session.lineItems[0]._id);

    const result = (await sessionService().updateLineItem(session, id, {
      quantity: 5,
    })) as SessionModel['draftSessionResponse'];

    expect(result.lineItems[0]).toMatchObject({
      quantity: 5,
      unitPriceCents: 200,
      lineTotalCents: 1000,
      aiConfidence: 1,
    });
    expect(result.totalCents).toBe(4230);
  });

  it('clears the low-confidence flag when the name is corrected', async () => {
    const session = draftSession();
    const id = String(session.lineItems[1]._id);

    const result = (await sessionService().updateLineItem(session, id, {
      name: 'Tapa de jamón',
    })) as SessionModel['draftSessionResponse'];

    expect(result.lineItems[1]).toMatchObject({
      name: 'Tapa de jamón',
      aiConfidence: 1,
    });
  });

  it('clears the low-confidence flag on a quantity edit too', async () => {
    const session = draftSession();
    const id = String(session.lineItems[1]._id);

    const result = (await sessionService().updateLineItem(session, id, {
      quantity: 2,
    })) as SessionModel['draftSessionResponse'];

    expect(result.lineItems[1]).toMatchObject({
      quantity: 2,
      lineTotalCents: 700,
      aiConfidence: 1,
    });
    expect(result.totalCents).toBe(4230);
  });

  it('leaves confidence untouched for an empty patch', async () => {
    const session = draftSession();
    const id = String(session.lineItems[1]._id);

    const result = (await sessionService().updateLineItem(
      session,
      id,
      {},
    )) as SessionModel['draftSessionResponse'];

    expect(result.lineItems[1]).toMatchObject({ aiConfidence: 0.4 });
    expect(result.totalCents).toBe(4230);
  });

  it('leaves the total untouched when only the name changes', async () => {
    const session = draftSession();
    const id = String(session.lineItems[0]._id);

    const result = (await sessionService().updateLineItem(session, id, {
      name: 'Cerveza',
    })) as SessionModel['draftSessionResponse'];

    expect(result.lineItems[0]).toMatchObject({
      name: 'Cerveza',
      lineTotalCents: 600,
    });
    expect(result.totalCents).toBe(4230);
  });

  it('returns 404 when the line item is missing', async () => {
    const result = await sessionService().updateLineItem(
      draftSession(),
      '507f1f77bcf86cd799439011',
      { name: 'x' },
    );

    expect(result).toMatchObject({
      code: 404,
      response: 'Line item not found',
    });
  });

  it('returns 409 when the session is not a draft', async () => {
    const session = draftSession();
    session.status = 'closed';

    const result = await sessionService().updateLineItem(session, 'lid', {
      name: 'x',
    });

    expect(result).toMatchObject({
      code: 409,
      response: 'Session is not editable',
    });
  });
});

describe('SessionService.deleteLineItem', () => {
  beforeEach(() => {
    spyOn(console, 'error').mockImplementation(() => {});
    spyOn(Session.prototype, 'save').mockImplementation(async function (
      this: unknown,
    ) {
      return this;
    });
  });

  afterEach(() => {
    mock.restore();
  });

  it('removes the line and leaves the receipt total alone', async () => {
    const session = draftSession();
    const id = String(session.lineItems[0]._id);

    const result = (await sessionService().deleteLineItem(
      session,
      id,
    )) as SessionModel['draftSessionResponse'];

    expect(session.lineItems).toHaveLength(1);
    expect(result.lineItems).toHaveLength(1);
    expect(result.lineItems[0]).toMatchObject({ name: 'Tapa' });
    expect(result.totalCents).toBe(4230);
  });

  it('keeps the total readable once every line is gone', async () => {
    const session = draftSession();

    for (const id of session.lineItems.map((item) => String(item._id)))
      await sessionService().deleteLineItem(session, id);

    expect(session.lineItems).toHaveLength(0);
    expect(session.totalCents).toBe(4230);
  });

  it('returns 404 when the line item is missing', async () => {
    const result = await sessionService().deleteLineItem(
      draftSession(),
      '507f1f77bcf86cd799439011',
    );

    expect(result).toMatchObject({
      code: 404,
      response: 'Line item not found',
    });
  });

  it('returns 409 when the session is not a draft', async () => {
    const session = draftSession();
    session.status = 'closed';

    const result = await sessionService().deleteLineItem(session, 'lid');

    expect(result).toMatchObject({
      code: 409,
      response: 'Session is not editable',
    });
  });
});

const CODE_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;

describe('generateSessionCode', () => {
  it('draws 8 characters from the unambiguous alphabet', () => {
    // Over many draws, an I/O/0/1 slipping into the alphabet would show up here.
    for (let i = 0; i < 200; i++)
      expect(generateSessionCode()).toMatch(CODE_PATTERN);
  });

  it('does not repeat itself', () => {
    const codes = new Set(Array.from({ length: 100 }, generateSessionCode));

    expect(codes.size).toBe(100);
  });
});

/**
 * The shared `extracted` fixture fails review by design: it reads a total the
 * lines fall short of, and one of those lines is barely legible.
 */
const confirmable: ExtractedReceipt = {
  ...extracted,
  totalCents: 950,
  lineItems: extracted.lineItems.map((item) => ({
    ...item,
    aiConfidence: 0.9,
  })),
};

function confirmableSession() {
  return new Session(
    buildDraftPayload(deviceTokenHash, confirmable, '/receipts/abc.jpg'),
  );
}

function duplicateKeyError(keyPattern: Record<string, 1> = { code: 1 }) {
  return Object.assign(new Error('E11000 duplicate key'), {
    code: 11000,
    keyPattern,
  });
}

type PublishAttempt = { filter: Record<string, unknown>; code: string };

/**
 * Stands in for the conditional publish, applying the `$set` to `target` so the
 * returned document is the one the caller gets a view of. Every attempt is
 * recorded, so a test can assert what the compare-and-swap was keyed on.
 */
function mockPublish(target: HydratedDocument<Session> | null) {
  const attempts: PublishAttempt[] = [];
  spyOn(Session, 'findOneAndUpdate').mockImplementation(((
    filter: Record<string, unknown>,
    update: { $set: Record<string, unknown> },
  ) => {
    attempts.push({ filter, code: String(update.$set.code) });
    if (!target) return Promise.resolve(null);
    Object.assign(target, update.$set);
    return Promise.resolve(target);
  }) as never);
  return attempts;
}

describe('SessionService.confirmSession', () => {
  beforeEach(() => {
    spyOn(console, 'error').mockImplementation(() => {});
    spyOn(Session.prototype, 'save').mockImplementation(async function (
      this: unknown,
    ) {
      return this;
    });
  });

  afterEach(() => {
    mock.restore();
  });

  it('publishes the session with a share code', async () => {
    const session = confirmableSession();
    const attempts = mockPublish(session);

    const result = (await sessionService().confirmSession(
      session,
    )) as SessionModel['draftSessionResponse'];

    expect(result.status).toBe('open');
    expect(result.code).toMatch(CODE_PATTERN);
    expect(attempts).toHaveLength(1);
    expect(attempts[0].code).toBe(result.code as string);
  });

  it('only publishes a session that is still a draft', async () => {
    const session = confirmableSession();
    const attempts = mockPublish(session);

    await sessionService().confirmSession(session);

    expect(attempts[0].filter).toEqual({
      _id: session._id,
      status: 'draft',
    });
  });

  it('returns 409 when another request published first', async () => {
    const session = confirmableSession();
    mockPublish(null);

    const result = await sessionService().confirmSession(session);

    expect(result).toMatchObject({
      code: 409,
      response: 'Session is not editable',
    });
  });

  it('returns 409 when the session is not a draft', async () => {
    const session = confirmableSession();
    session.status = 'open';

    const result = await sessionService().confirmSession(session);

    expect(result).toMatchObject({
      code: 409,
      response: 'Session is not editable',
    });
  });

  it('returns 409 when there is nothing to split', async () => {
    const session = confirmableSession();
    session.lineItems.splice(0);

    const result = await sessionService().confirmSession(session);

    expect(result).toMatchObject({
      code: 409,
      response: 'Session has no items to split',
    });
  });

  it('returns 409 while an item is still below the confidence threshold', async () => {
    const session = confirmableSession();
    session.lineItems[1].aiConfidence = 0.4;

    const result = await sessionService().confirmSession(session);

    expect(result).toMatchObject({
      code: 409,
      response: 'Some items still need review',
    });
    expect(session.code).toBeUndefined();
  });

  it('returns 409 while the items fall short of the receipt total', async () => {
    const session = confirmableSession();
    session.totalCents = 1100;

    const result = await sessionService().confirmSession(session);

    expect(result).toMatchObject({
      code: 409,
      response: 'Items do not add up to the receipt total',
    });
    expect(session.status).toBe('draft');
    expect(session.code).toBeUndefined();
  });

  it('publishes once the owner has brought the two together', async () => {
    const session = confirmableSession();
    session.totalCents = 1100;
    mockPublish(session);

    await sessionService().addLineItem(session, {
      name: 'Vino',
      quantity: 1,
      unitPriceCents: 150,
    });
    const result = (await sessionService().confirmSession(
      session,
    )) as SessionModel['draftSessionResponse'];

    expect(lineSumCents(session)).toBe(1100);
    expect(result.status).toBe('open');
  });

  it('regenerates the code when the unique index rejects a duplicate', async () => {
    const session = confirmableSession();
    const attempted: string[] = [];
    spyOn(Session, 'findOneAndUpdate').mockImplementation(((
      _filter: unknown,
      update: { $set: Record<string, unknown> },
    ) => {
      attempted.push(String(update.$set.code));
      if (attempted.length === 1) return Promise.reject(duplicateKeyError());
      Object.assign(session, update.$set);
      return Promise.resolve(session);
    }) as never);

    const result = (await sessionService().confirmSession(
      session,
    )) as SessionModel['draftSessionResponse'];

    expect(attempted).toHaveLength(2);
    expect(attempted[0]).not.toBe(attempted[1]);
    expect(result.code).toBe(attempted[1]);
  });

  it('returns 500 once the code attempts run out', async () => {
    const publish = spyOn(Session, 'findOneAndUpdate').mockRejectedValue(
      duplicateKeyError(),
    );

    const result = await sessionService().confirmSession(confirmableSession());

    expect(result).toMatchObject({
      code: 500,
      response: 'Failed to generate a session code',
    });
    expect(publish).toHaveBeenCalledTimes(5);
  });

  it('lets an unrelated write failure bubble up to the module handler', async () => {
    spyOn(Session, 'findOneAndUpdate').mockRejectedValue(
      new Error('mongo down'),
    );

    await expect(
      sessionService().confirmSession(confirmableSession()),
    ).rejects.toThrow('mongo down');
  });

  it('lets a duplicate without a key pattern bubble up instead of retrying', async () => {
    const publish = spyOn(Session, 'findOneAndUpdate').mockRejectedValue(
      Object.assign(new Error('E11000 duplicate key'), { code: 11000 }),
    );

    await expect(
      sessionService().confirmSession(confirmableSession()),
    ).rejects.toThrow('E11000 duplicate key');
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it('lets a duplicate on another key bubble up instead of retrying', async () => {
    const publish = spyOn(Session, 'findOneAndUpdate').mockRejectedValue(
      duplicateKeyError({ 'participants.deviceTokenHash': 1 }),
    );

    await expect(
      sessionService().confirmSession(confirmableSession()),
    ).rejects.toThrow('E11000 duplicate key');
    expect(publish).toHaveBeenCalledTimes(1);
  });
});

function openSession() {
  const session = new Session(
    buildDraftPayload(deviceTokenHash, extracted, '/receipts/abc.jpg'),
  );
  session.status = 'open';
  session.set('__v', 7);
  session.participants.push({
    name: 'Luis',
    deviceTokenHash: hashToken('guest-token'),
    isOwner: false,
  });
  return session;
}

function fakeEvents() {
  return {
    publish: mock(() => {}),
    subscribe: mock(() => {
      throw new Error('not used in these tests');
    }),
    close: mock(() => {}),
  };
}

type ClaimAttempt = {
  filter: Record<string, unknown>;
  claims: { participantId: unknown; units: number }[];
};

/**
 * Stands in for the claim compare-and-swap, applying the `$set` claims array
 * to the matching line item of `target`. Every attempt is recorded so a test
 * can assert what the swap was keyed on.
 */
function mockClaimWrite(target: HydratedDocument<Session> | null) {
  const attempts: ClaimAttempt[] = [];
  spyOn(Session, 'findOneAndUpdate').mockImplementation(((
    filter: Record<string, unknown>,
    update: { $set: Record<string, unknown> },
    options: { arrayFilters: [{ 'item._id': unknown }] },
  ) => {
    const claims = update.$set[
      'lineItems.$[item].claims'
    ] as ClaimAttempt['claims'];
    attempts.push({ filter, claims });
    if (!target) return Promise.resolve(null);
    const lineItem = target.lineItems.id(
      String(options.arrayFilters[0]['item._id']),
    );
    if (lineItem) lineItem.set('claims', claims);
    return Promise.resolve(target);
  }) as never);
  return attempts;
}

describe('SessionService.setClaim', () => {
  afterEach(() => {
    mock.restore();
  });

  function serviceWith(events = fakeEvents()) {
    return {
      events,
      service: new SessionService(
        mock<ExtractReceipt>(async () => extracted),
        fakeStorage(),
        events,
      ),
    };
  }

  it('upserts the caller claim with an absolute unit count', async () => {
    const session = openSession();
    const me = String(session.participants[1]._id);
    const lineItemId = String(session.lineItems[0]._id);
    const attempts = mockClaimWrite(session);
    const { service, events } = serviceWith();

    const result = (await service.setClaim(
      session,
      me,
      lineItemId,
      2,
    )) as SessionModel['draftSessionResponse'];

    expect(result.lineItems[0].claims).toEqual([
      { participantId: me, units: 2 },
    ]);
    expect(attempts).toHaveLength(1);
    expect(attempts[0].filter).toMatchObject({ status: 'open', __v: 7 });
    expect(events.publish).toHaveBeenCalledWith(String(session._id), {
      type: 'claims-updated',
      at: expect.any(String),
    });
  });

  it('replaces the previous claim instead of accumulating', async () => {
    const session = openSession();
    const me = String(session.participants[1]._id);
    session.lineItems[0].claims.push({
      participantId: session.participants[1]._id,
      units: 2,
    });
    const lineItemId = String(session.lineItems[0]._id);
    mockClaimWrite(session);
    const { service } = serviceWith();

    const result = (await service.setClaim(
      session,
      me,
      lineItemId,
      1,
    )) as SessionModel['draftSessionResponse'];

    expect(result.lineItems[0].claims).toEqual([
      { participantId: me, units: 1 },
    ]);
  });

  it('removes the claim when units is zero', async () => {
    const session = openSession();
    const me = String(session.participants[1]._id);
    session.lineItems[0].claims.push({
      participantId: session.participants[1]._id,
      units: 2,
    });
    const lineItemId = String(session.lineItems[0]._id);
    mockClaimWrite(session);
    const { service } = serviceWith();

    const result = (await service.setClaim(
      session,
      me,
      lineItemId,
      0,
    )) as SessionModel['draftSessionResponse'];

    expect(result.lineItems[0].claims).toEqual([]);
  });

  it('keeps other participants claims untouched', async () => {
    const session = openSession();
    const owner = String(session.participants[0]._id);
    const me = String(session.participants[1]._id);
    session.lineItems[0].claims.push({
      participantId: session.participants[0]._id,
      units: 1,
    });
    const lineItemId = String(session.lineItems[0]._id);
    mockClaimWrite(session);
    const { service } = serviceWith();

    const result = (await service.setClaim(
      session,
      me,
      lineItemId,
      2,
    )) as SessionModel['draftSessionResponse'];

    expect(result.lineItems[0].claims).toEqual([
      { participantId: owner, units: 1 },
      { participantId: me, units: 2 },
    ]);
  });

  it('rejects a claim on a session that is not open', async () => {
    const session = openSession();
    session.status = 'closed';
    const { service, events } = serviceWith();

    const result = await service.setClaim(
      session,
      String(session.participants[1]._id),
      String(session.lineItems[0]._id),
      1,
    );

    expect(result).toMatchObject({
      code: 409,
      response: 'Session is not open',
    });
    expect(events.publish).not.toHaveBeenCalled();
  });

  it('rejects a claim on a missing line item', async () => {
    const session = openSession();
    const { service } = serviceWith();

    const result = await service.setClaim(
      session,
      String(session.participants[1]._id),
      '000000000000000000000000',
      1,
    );

    expect(result).toMatchObject({
      code: 404,
      response: 'Line item not found',
    });
  });

  it('rejects units beyond what other participants left available', async () => {
    const session = openSession();
    session.lineItems[0].claims.push({
      participantId: session.participants[0]._id,
      units: 2,
    });
    const { service, events } = serviceWith();

    const result = await service.setClaim(
      session,
      String(session.participants[1]._id),
      String(session.lineItems[0]._id),
      2,
    );

    expect(result).toMatchObject({
      code: 409,
      response: 'Not enough units available',
    });
    expect(events.publish).not.toHaveBeenCalled();
  });

  it('does not count the caller previous claim against availability', async () => {
    const session = openSession();
    session.lineItems[0].claims.push({
      participantId: session.participants[1]._id,
      units: 3,
    });
    const me = String(session.participants[1]._id);
    mockClaimWrite(session);
    const { service } = serviceWith();

    const result = (await service.setClaim(
      session,
      me,
      String(session.lineItems[0]._id),
      3,
    )) as SessionModel['draftSessionResponse'];

    expect(result.lineItems[0].claims).toEqual([
      { participantId: me, units: 3 },
    ]);
  });

  it('rereads and retries when the compare-and-swap misses', async () => {
    const session = openSession();
    const me = String(session.participants[1]._id);
    const lineItemId = String(session.lineItems[0]._id);

    const write = spyOn(Session, 'findOneAndUpdate')
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(session);
    spyOn(Session, 'findById').mockImplementation((async () => {
      session.set('__v', 8);
      return session;
    }) as never);
    const { service } = serviceWith();

    const result = await service.setClaim(session, me, lineItemId, 1);

    expect(write).toHaveBeenCalledTimes(2);
    expect(write.mock.calls[0][0]).toMatchObject({ __v: 7 });
    expect(write.mock.calls[1][0]).toMatchObject({ __v: 8 });
    expect(result).toMatchObject({ status: 'open' });
  });

  it('gives up with a conflict after exhausting retries', async () => {
    const session = openSession();

    spyOn(Session, 'findOneAndUpdate').mockResolvedValue(null);
    spyOn(Session, 'findById').mockResolvedValue(session);
    const { service, events } = serviceWith();

    const result = await service.setClaim(
      session,
      String(session.participants[1]._id),
      String(session.lineItems[0]._id),
      1,
    );

    expect(result).toMatchObject({
      code: 409,
      response: 'Claim conflicted, please retry',
    });
    expect(events.publish).not.toHaveBeenCalled();
  });
});

function fullyClaimedSession() {
  const session = openSession();
  session.lineItems[0].claims.push({
    participantId: session.participants[0]._id,
    units: 3,
  });
  session.lineItems[1].claims.push({
    participantId: session.participants[1]._id,
    units: 1,
  });
  return session;
}

type CloseAttempt = {
  filter: Record<string, unknown>;
  set: Record<string, unknown>;
};

function mockCloseWrite(target: HydratedDocument<Session> | null) {
  const attempts: CloseAttempt[] = [];
  spyOn(Session, 'findOneAndUpdate').mockImplementation(((
    filter: Record<string, unknown>,
    update: { $set: Record<string, unknown> },
  ) => {
    attempts.push({ filter, set: update.$set });
    if (!target) return Promise.resolve(null);
    Object.assign(target, update.$set);
    return Promise.resolve(target);
  }) as never);
  return attempts;
}

describe('SessionService.closeSession', () => {
  afterEach(() => {
    mock.restore();
  });

  function serviceWith(events = fakeEvents()) {
    return {
      events,
      service: new SessionService(
        mock<ExtractReceipt>(async () => extracted),
        fakeStorage(),
        events,
      ),
    };
  }

  it('closes a fully claimed open session', async () => {
    const session = fullyClaimedSession();
    const attempts = mockCloseWrite(session);
    const { service, events } = serviceWith();

    const result = (await service.closeSession(
      session,
    )) as SessionModel['draftSessionResponse'];

    expect(result.status).toBe('closed');
    expect(typeof result.closedAt).toBe('string');
    expect(attempts).toHaveLength(1);
    expect(attempts[0].filter).toEqual({
      _id: session._id,
      status: 'open',
      __v: 7,
    });
    expect(attempts[0].set).toMatchObject({
      status: 'closed',
      closedAt: expect.any(Date),
    });
    expect(events.publish).toHaveBeenCalledTimes(1);
    expect(events.publish).toHaveBeenCalledWith(String(session._id), {
      type: 'session-closed',
      at: expect.any(String),
    });
  });

  it('rejects closing a draft', async () => {
    const session = fullyClaimedSession();
    session.status = 'draft';
    const attempts = mockCloseWrite(session);
    const { service, events } = serviceWith();

    const result = await service.closeSession(session);

    expect(result).toMatchObject({
      code: 409,
      response: 'Session is not open',
    });
    expect(attempts).toHaveLength(0);
    expect(events.publish).not.toHaveBeenCalled();
  });

  it('rejects closing an already closed session', async () => {
    const session = fullyClaimedSession();
    session.status = 'closed';
    const { service } = serviceWith();

    const result = await service.closeSession(session);

    expect(result).toMatchObject({
      code: 409,
      response: 'Session is not open',
    });
  });

  it('rejects closing while no units are claimed', async () => {
    const session = openSession();
    const attempts = mockCloseWrite(session);
    const { service, events } = serviceWith();

    const result = await service.closeSession(session);

    expect(result).toMatchObject({
      code: 409,
      response: 'Some units are still unassigned',
    });
    expect(attempts).toHaveLength(0);
    expect(events.publish).not.toHaveBeenCalled();
  });

  it('rejects closing while some units remain unassigned', async () => {
    const session = fullyClaimedSession();
    session.lineItems[0].claims[0].units = 2;
    const { service } = serviceWith();

    const result = await service.closeSession(session);

    expect(result).toMatchObject({
      code: 409,
      response: 'Some units are still unassigned',
    });
  });

  it('treats a zero-quantity line item as fully assigned', async () => {
    const session = fullyClaimedSession();
    session.lineItems.push({
      name: 'Propina',
      quantity: 0,
      unitPriceCents: 0,
      lineTotalCents: 0,
      aiConfidence: 1,
      claims: [],
    });
    mockCloseWrite(session);
    const { service } = serviceWith();

    const result = (await service.closeSession(
      session,
    )) as SessionModel['draftSessionResponse'];

    expect(result.status).toBe('closed');
  });

  it('rereads and retries when the compare-and-swap misses', async () => {
    const session = fullyClaimedSession();

    const write = spyOn(Session, 'findOneAndUpdate')
      .mockResolvedValueOnce(null)
      .mockImplementationOnce(((
        _filter: unknown,
        update: { $set: Record<string, unknown> },
      ) => {
        Object.assign(session, update.$set);
        return Promise.resolve(session);
      }) as never);
    spyOn(Session, 'findById').mockImplementation((async () => {
      session.set('__v', 8);
      return session;
    }) as never);
    const { service, events } = serviceWith();

    const result = (await service.closeSession(
      session,
    )) as SessionModel['draftSessionResponse'];

    expect(write).toHaveBeenCalledTimes(2);
    expect(write.mock.calls[0][0]).toMatchObject({ __v: 7 });
    expect(write.mock.calls[1][0]).toMatchObject({ __v: 8 });
    expect(result.status).toBe('closed');
    expect(events.publish).toHaveBeenCalledTimes(1);
  });

  it('rechecks the units on retry and rejects a released claim', async () => {
    const session = fullyClaimedSession();

    spyOn(Session, 'findOneAndUpdate').mockResolvedValue(null);
    spyOn(Session, 'findById').mockImplementation((async () => {
      session.lineItems[0].claims.splice(0);
      session.set('__v', 8);
      return session;
    }) as never);
    const { service, events } = serviceWith();

    const result = await service.closeSession(session);

    expect(result).toMatchObject({
      code: 409,
      response: 'Some units are still unassigned',
    });
    expect(events.publish).not.toHaveBeenCalled();
  });

  it('gives up with a conflict after exhausting retries', async () => {
    const session = fullyClaimedSession();

    const write = spyOn(Session, 'findOneAndUpdate').mockResolvedValue(null);
    spyOn(Session, 'findById').mockResolvedValue(session);
    const { service, events } = serviceWith();

    const result = await service.closeSession(session);

    expect(result).toMatchObject({
      code: 409,
      response: 'Close conflicted, please retry',
    });
    expect(write).toHaveBeenCalledTimes(3);
    expect(events.publish).not.toHaveBeenCalled();
  });

  it('returns 404 when the session vanishes before a retry', async () => {
    const session = fullyClaimedSession();

    spyOn(Session, 'findOneAndUpdate').mockResolvedValue(null);
    spyOn(Session, 'findById').mockResolvedValue(null);
    const { service } = serviceWith();

    const result = await service.closeSession(session);

    expect(result).toMatchObject({
      code: 404,
      response: 'Session not found',
    });
  });
});
