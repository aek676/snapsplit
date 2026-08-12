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
        throw new Error('gcs down');
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
    expect(result.totalCents).toBe(4830);
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
    expect(result.totalCents).toBe(4630);
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
    expect(result.totalCents).toBe(4580);
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

  it('removes the line and subtracts its total from the session', async () => {
    const session = draftSession();
    const id = String(session.lineItems[0]._id);

    const result = (await sessionService().deleteLineItem(
      session,
      id,
    )) as SessionModel['draftSessionResponse'];

    expect(session.lineItems).toHaveLength(1);
    expect(result.lineItems).toHaveLength(1);
    expect(result.lineItems[0]).toMatchObject({ name: 'Tapa' });
    expect(result.totalCents).toBe(3630);
  });

  it('clamps the session total at 0 instead of going negative', async () => {
    const session = draftSession();
    session.totalCents = 100;
    const id = String(session.lineItems[0]._id);

    const result = (await sessionService().deleteLineItem(
      session,
      id,
    )) as SessionModel['draftSessionResponse'];

    expect(result.totalCents).toBe(0);
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

/** The shared `extracted` fixture fails review, by design. */
const confirmable: ExtractedReceipt = {
  ...extracted,
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

function duplicateKeyError() {
  return Object.assign(new Error('E11000 duplicate key'), {
    code: 11000,
    keyPattern: { code: 1 },
  });
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

    const result = (await sessionService().confirmSession(
      session,
    )) as SessionModel['draftSessionResponse'];

    expect(result.status).toBe('open');
    expect(result.code).toMatch(CODE_PATTERN);
    expect(session.status).toBe('open');
    expect(session.code).toBe(result.code);
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

  it('regenerates the code when the unique index rejects a duplicate', async () => {
    const attempted: (string | null)[] = [];
    spyOn(Session.prototype, 'save').mockImplementation(async function (
      this: HydratedDocument<Session>,
    ) {
      attempted.push(this.code ?? null);
      if (attempted.length === 1) throw duplicateKeyError();
      return this;
    });

    const result = (await sessionService().confirmSession(
      confirmableSession(),
    )) as SessionModel['draftSessionResponse'];

    expect(attempted).toHaveLength(2);
    expect(attempted[0]).not.toBe(attempted[1]);
    expect(result.code).toBe(attempted[1]);
  });

  it('returns 500 once the code attempts run out', async () => {
    spyOn(Session.prototype, 'save').mockRejectedValue(duplicateKeyError());

    const result = await sessionService().confirmSession(confirmableSession());

    expect(result).toMatchObject({
      code: 500,
      response: 'Failed to generate a session code',
    });
  });

  it('lets an unrelated write failure bubble up to the module handler', async () => {
    spyOn(Session.prototype, 'save').mockRejectedValue(new Error('mongo down'));

    expect(
      sessionService().confirmSession(confirmableSession()),
    ).rejects.toThrow('mongo down');
  });
});
