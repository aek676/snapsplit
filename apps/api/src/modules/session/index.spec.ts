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
import { hashToken } from '../auth/service';
import { createSessionModule } from './index';
import { buildDraftPayload, SessionService } from './service';

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

describe('POST /sessions/analyze', () => {
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

function jsonRequest(path: string, method: string, body: unknown) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function draftSession() {
  return new Session(
    buildDraftPayload(
      hashToken('device-token-abc'),
      extracted,
      '/receipts/abc.jpg',
    ),
  );
}

describe('line item routes', () => {
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

  it('POST adds a line item and returns 200 with the updated view', async () => {
    spyOn(Session, 'findById').mockResolvedValue(draftSession());
    const app = moduleWith(mock<ExtractReceipt>(async () => extracted));

    const res = await app.handle(
      jsonRequest('/sessions/sid/line-items', 'POST', {
        name: 'Vino',
        quantity: 2,
        unitPriceCents: 300,
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.lineItems).toHaveLength(2);
    expect(body.lineItems[1]).toMatchObject({
      name: 'Vino',
      lineTotalCents: 600,
      aiConfidence: 1,
    });
  });

  it('POST returns 404 when the session is missing', async () => {
    spyOn(Session, 'findById').mockResolvedValue(null);
    const app = moduleWith(mock<ExtractReceipt>(async () => extracted));

    const res = await app.handle(
      jsonRequest('/sessions/sid/line-items', 'POST', {
        name: 'Vino',
        quantity: 1,
        unitPriceCents: 100,
      }),
    );

    expect(res.status).toBe(404);
    expect(await res.text()).toBe('Session not found');
  });

  it('POST returns 422 when a numeric field is negative', async () => {
    const app = moduleWith(mock<ExtractReceipt>(async () => extracted));

    const res = await app.handle(
      jsonRequest('/sessions/sid/line-items', 'POST', {
        name: 'Vino',
        quantity: -1,
        unitPriceCents: 100,
      }),
    );

    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ type: 'validation', on: 'body' });
  });

  it('PATCH edits a line item and recomputes the total', async () => {
    const session = draftSession();
    const id = String(session.lineItems[0]._id);
    spyOn(Session, 'findById').mockResolvedValue(session);
    const app = moduleWith(mock<ExtractReceipt>(async () => extracted));

    const res = await app.handle(
      jsonRequest(`/sessions/sid/line-items/${id}`, 'PATCH', { quantity: 4 }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.lineItems[0]).toMatchObject({
      quantity: 4,
      lineTotalCents: 800,
    });
  });

  it('PATCH returns 404 when the line item is missing', async () => {
    spyOn(Session, 'findById').mockResolvedValue(draftSession());
    const app = moduleWith(mock<ExtractReceipt>(async () => extracted));

    const res = await app.handle(
      jsonRequest(
        '/sessions/sid/line-items/507f1f77bcf86cd799439011',
        'PATCH',
        {
          name: 'x',
        },
      ),
    );

    expect(res.status).toBe(404);
    expect(await res.text()).toBe('Line item not found');
  });

  it('POST maps an unexpected error to 500 via onError', async () => {
    spyOn(Session, 'findById').mockRejectedValue(new Error('mongo down'));
    const app = moduleWith(mock<ExtractReceipt>(async () => extracted));

    const res = await app.handle(
      jsonRequest('/sessions/sid/line-items', 'POST', {
        name: 'Vino',
        quantity: 1,
        unitPriceCents: 100,
      }),
    );

    expect(res.status).toBe(500);
    expect(await res.text()).toBe('Unexpected server error');
  });
});

describe('GET /sessions/:sessionId', () => {
  beforeEach(() => {
    spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    mock.restore();
  });

  it('returns 200 with the session view', async () => {
    spyOn(Session, 'findById').mockResolvedValue(draftSession());
    const app = moduleWith(mock<ExtractReceipt>(async () => extracted));

    const res = await app.handle(
      new Request('http://localhost/sessions/sid', { method: 'GET' }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ status: 'draft', totalCents: 600 });
    expect(body.lineItems).toHaveLength(1);
  });

  it('returns 404 when the session is missing', async () => {
    spyOn(Session, 'findById').mockResolvedValue(null);
    const app = moduleWith(mock<ExtractReceipt>(async () => extracted));

    const res = await app.handle(
      new Request('http://localhost/sessions/sid', { method: 'GET' }),
    );

    expect(res.status).toBe(404);
    expect(await res.text()).toBe('Session not found');
  });
});

describe('DELETE /sessions/:sessionId/line-items/:lineItemId', () => {
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

  it('removes the line and returns 200 with the updated view', async () => {
    const session = draftSession();
    const id = String(session.lineItems[0]._id);
    spyOn(Session, 'findById').mockResolvedValue(session);
    const app = moduleWith(mock<ExtractReceipt>(async () => extracted));

    const res = await app.handle(
      new Request(`http://localhost/sessions/sid/line-items/${id}`, {
        method: 'DELETE',
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.lineItems).toHaveLength(0);
    expect(body.totalCents).toBe(0);
  });

  it('returns 404 when the line item is missing', async () => {
    spyOn(Session, 'findById').mockResolvedValue(draftSession());
    const app = moduleWith(mock<ExtractReceipt>(async () => extracted));

    const res = await app.handle(
      new Request(
        'http://localhost/sessions/sid/line-items/507f1f77bcf86cd799439011',
        { method: 'DELETE' },
      ),
    );

    expect(res.status).toBe(404);
    expect(await res.text()).toBe('Line item not found');
  });
});
