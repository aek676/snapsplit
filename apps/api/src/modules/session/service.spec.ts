import { describe, expect, it } from 'bun:test';
import type { ExtractedReceipt } from '../../ai/receipt';
import { Session } from '../../schemas';
import { buildDraftPayload, toSessionView } from './service';

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

    // No participants yet: the owner is created when they enter the session.
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
    // `new Session(...)` builds the document (and subdoc _ids) without touching Mongo.
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
