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
import { createSessionModule } from './index';
import { SessionService } from './service';

const extracted: ExtractedReceipt = {
  merchant: 'Bar Paco',
  date: '2026-07-07',
  currency: 'EUR',
  totalCents: 600,
  lineItems: [
    {
      name: 'Caña',
      quantity: 3,
      unitPriceCents: 200,
      lineTotalCents: 600,
      aiConfidence: 0.94,
    },
  ],
};

function fakeStorage(overrides: Partial<ReceiptStorage> = {}): ReceiptStorage {
  return {
    save: mock(async () => ({ id: 'stored-123' })),
    get: mock(async () => null),
    delete: mock(async () => {}),
    ...overrides,
  };
}

function moduleWith(extract: ExtractReceipt, storage = fakeStorage()) {
  return createSessionModule(new SessionService(extract, storage));
}

function analyzeRequest(file: File) {
  const form = new FormData();
  form.append('image', file);
  return new Request('http://localhost/sessions/analyze', {
    method: 'POST',
    body: form,
  });
}

const PNG_BYTES = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  ),
);

const imageFile = (type = 'image/png') =>
  new File([PNG_BYTES], 'receipt.png', { type });

describe('POST /sessions/analyze (controller)', () => {
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

  it('returns 200 with the serialized draft view', async () => {
    const app = moduleWith(mock<ExtractReceipt>(async () => extracted));

    const res = await app.handle(analyzeRequest(imageFile('image/png')));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      status: 'draft',
      merchant: 'Bar Paco',
      receiptImageUrl: '/receipts/stored-123',
    });
  });

  it('returns 422 when the image field is missing', async () => {
    const app = moduleWith(mock<ExtractReceipt>(async () => extracted));

    const res = await app.handle(
      new Request('http://localhost/sessions/analyze', {
        method: 'POST',
        body: new FormData(),
      }),
    );

    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({
      type: 'validation',
      on: 'body',
      property: '/image',
    });
  });

  it('returns 422 when the file is not an image', async () => {
    const app = moduleWith(mock<ExtractReceipt>(async () => extracted));

    const res = await app.handle(
      analyzeRequest(new File(['nope'], 'r.txt', { type: 'text/plain' })),
    );

    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({
      type: 'validation',
      on: 'body',
      property: '/image',
    });
  });

  it('propagates the service 502 when extraction fails', async () => {
    const app = moduleWith(
      mock<ExtractReceipt>(async () => {
        throw new Error('gemini exploded');
      }),
    );

    const res = await app.handle(analyzeRequest(imageFile()));

    expect(res.status).toBe(502);
    expect(await res.text()).toBe('Receipt analysis failed');
  });

  it('maps an unexpected error to 500 via onError', async () => {
    spyOn(Session.prototype, 'save').mockRejectedValue(new Error('mongo down'));
    const storage = fakeStorage();
    const app = moduleWith(
      mock<ExtractReceipt>(async () => extracted),
      storage,
    );

    const res = await app.handle(analyzeRequest(imageFile()));

    expect(res.status).toBe(500);
    expect(await res.text()).toBe('Failed to create draft session');
    expect(storage.delete).toHaveBeenCalledWith('stored-123');
  });
});
