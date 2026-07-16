import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  spyOn,
} from 'bun:test';
import type { ExtractedReceipt, ExtractReceipt } from '../../ai/receipt';
import { Session } from '../../schemas';
import type { ReceiptStorage } from '../../storage/receipt-storage';
import type { SessionModel } from './model';
import { buildDraftPayload, SessionService, toSessionView } from './service';

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
    const payload = buildDraftPayload(extracted, '/receipts/abc.jpg');

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

    expect(payload.participants).toHaveLength(0);
  });

  it('tolerates a null merchant/date', () => {
    const payload = buildDraftPayload(
      { ...extracted, merchant: null, date: null },
      '/receipts/x.png',
    );

    expect(payload.merchant).toBeUndefined();
    expect(payload.date).toBeUndefined();
  });
});

describe('toSessionView', () => {
  it('serializes a session document to the plain API view', () => {
    const payload = buildDraftPayload(extracted, '/receipts/abc.jpg');
    const doc = new Session(payload);

    const view = toSessionView(doc);

    expect(view.id).toBe(String(doc._id));
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

function fakeStorage(overrides: Partial<ReceiptStorage> = {}): ReceiptStorage {
  return {
    save: mock(async () => ({ id: 'stored-123' })),
    get: mock(async () => null),
    delete: mock(async () => {}),
    ...overrides,
  };
}

describe('SessionService.createDraftFromImage', () => {
  beforeEach(() => {
    spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    mock.restore();
  });

  it('extracts, stores and persists a draft, returning its view', async () => {
    spyOn(Session.prototype, 'save').mockImplementation(async function (
      this: unknown,
    ) {
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
    expect((storage.save as ReturnType<typeof mock>).mock.calls[0][0]).toEqual(
      bytes,
    );
    expect((storage.save as ReturnType<typeof mock>).mock.calls[0][1]).toBe(
      'image/png',
    );

    // The happy path returns the serialized session view, not a status error.
    expect(result).toMatchObject({
      status: 'draft',
      merchant: 'Bar Paco',
      receiptImageUrl: '/receipts/stored-123',
    });
    expect(
      (result as SessionModel['draftSessionResponse']).lineItems,
    ).toHaveLength(2);
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
    // The orphaned upload is cleaned up so storage doesn't leak.
    expect(storage.delete).toHaveBeenCalledWith('stored-123');
  });
});
