import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  spyOn,
} from 'bun:test';
import type { ExtractedReceipt, ExtractReceipt } from '../../../ai/receipt';
import { Session } from '../../../schemas';
import type { ObjectStorage } from '../../../storage/object-storage';
import { hashToken } from '../../auth/service';
import { createSessionModule } from '../index';
import { buildDraftPayload, SessionService } from '../service';

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

function fakeStorage(overrides: Partial<ObjectStorage> = {}): ObjectStorage {
  return {
    save: mock(async () => {}),
    get: mock(async () => null),
    delete: mock(async () => {}),
    ...overrides,
  };
}

/** The key the service minted for the one image it stored. */
function storedKey(storage: ObjectStorage) {
  return (storage.save as ReturnType<typeof mock>).mock.calls[0][0] as string;
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
    const storage = fakeStorage();
    const app = moduleWith(
      mock<ExtractReceipt>(async () => extracted),
      storage,
    );

    const res = await app.handle(analyzeRequest(imageFile('image/png')));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      status: 'draft',
      merchant: 'Bar Paco',
      receiptImageUrl: `/receipts/${storedKey(storage)}`,
    });
    expect(storedKey(storage)).toMatch(/\.png$/);
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
    expect(storage.delete).toHaveBeenCalledWith(storedKey(storage));
  });
});

const OWNER_TOKEN = 'device-token-abc';
const GUEST_TOKEN = 'guest-token-xyz';

function draftSession() {
  return new Session(
    buildDraftPayload(hashToken(OWNER_TOKEN), extracted, '/receipts/abc.jpg'),
  );
}

function sessionWithGuest() {
  const session = draftSession();
  session.participants.push({
    deviceTokenHash: hashToken(GUEST_TOKEN),
    isOwner: false,
  });
  return session;
}

function mockLookup(session: unknown) {
  const promise = Promise.resolve(session);
  const query = Object.assign(promise, { select: mock(() => promise) });
  return spyOn(Session, 'findOne').mockImplementation((() => query) as never);
}

/** Stands in for the conditional publish, applying the `$set` to `target`. */
function mockPublish(target: unknown) {
  return spyOn(Session, 'findOneAndUpdate').mockImplementation(((
    _filter: unknown,
    update: { $set: Record<string, unknown> },
  ) => {
    if (!target) return Promise.resolve(null);
    Object.assign(target, update.$set);
    return Promise.resolve(target);
  }) as never);
}

function request(
  path: string,
  { method = 'GET', body, token = OWNER_TOKEN as string | null } = {} as {
    method?: string;
    body?: unknown;
    token?: string | null;
  },
) {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;
  return new Request(`http://localhost${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
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

  const newLine = { name: 'Vino', quantity: 2, unitPriceCents: 300 };

  it('POST adds a line item and returns 200 with the updated view', async () => {
    const session = draftSession();
    mockLookup(session);
    const app = moduleWith(mock<ExtractReceipt>(async () => extracted));

    const res = await app.handle(
      request(`/sessions/${session._id}/line-items`, {
        method: 'POST',
        body: newLine,
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

  it('POST returns 403 for a guest token', async () => {
    const session = sessionWithGuest();
    mockLookup(session);
    const app = moduleWith(mock<ExtractReceipt>(async () => extracted));

    const res = await app.handle(
      request(`/sessions/${session._id}/line-items`, {
        method: 'POST',
        body: newLine,
        token: GUEST_TOKEN,
      }),
    );

    expect(res.status).toBe(403);
    expect(await res.text()).toBe('Forbidden');
    expect(session.lineItems).toHaveLength(1);
  });

  it('POST returns 422 when a numeric field is negative', async () => {
    const session = draftSession();
    mockLookup(session);
    const app = moduleWith(mock<ExtractReceipt>(async () => extracted));

    const res = await app.handle(
      request(`/sessions/${session._id}/line-items`, {
        method: 'POST',
        body: { name: 'Vino', quantity: -1, unitPriceCents: 100 },
      }),
    );

    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ type: 'validation', on: 'body' });
  });

  it('PATCH edits a line item and recomputes the total', async () => {
    const session = draftSession();
    const id = String(session.lineItems[0]._id);
    mockLookup(session);
    const app = moduleWith(mock<ExtractReceipt>(async () => extracted));

    const res = await app.handle(
      request(`/sessions/${session._id}/line-items/${id}`, {
        method: 'PATCH',
        body: { quantity: 4 },
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.lineItems[0]).toMatchObject({
      quantity: 4,
      lineTotalCents: 800,
    });
  });

  it('PATCH returns 404 when the line item is missing', async () => {
    const session = draftSession();
    mockLookup(session);
    const app = moduleWith(mock<ExtractReceipt>(async () => extracted));

    const res = await app.handle(
      request(`/sessions/${session._id}/line-items/507f1f77bcf86cd799439011`, {
        method: 'PATCH',
        body: { name: 'x' },
      }),
    );

    expect(res.status).toBe(404);
    expect(await res.text()).toBe('Line item not found');
  });

  it('POST maps an unexpected error to 500 via onError', async () => {
    spyOn(Session, 'findOne').mockImplementation((() => {
      throw new Error('mongo down');
    }) as never);
    const app = moduleWith(mock<ExtractReceipt>(async () => extracted));

    const res = await app.handle(
      request('/sessions/507f191e810c19729de860ea/line-items', {
        method: 'POST',
        body: newLine,
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
    const session = draftSession();
    mockLookup(session);
    const app = moduleWith(mock<ExtractReceipt>(async () => extracted));

    const res = await app.handle(request(`/sessions/${session._id}`));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ status: 'draft', totalCents: 600 });
    expect(body.lineItems).toHaveLength(1);
  });

  it('never leaks the device token hashes', async () => {
    const session = sessionWithGuest();
    mockLookup(session);
    const app = moduleWith(mock<ExtractReceipt>(async () => extracted));

    const res = await app.handle(request(`/sessions/${session._id}`));

    const raw = await res.text();
    expect(raw).not.toContain('participants');
    expect(raw).not.toContain(hashToken(OWNER_TOKEN));
  });

  it('lets a guest read the session', async () => {
    const session = sessionWithGuest();
    mockLookup(session);
    const app = moduleWith(mock<ExtractReceipt>(async () => extracted));

    const res = await app.handle(
      request(`/sessions/${session._id}`, { token: GUEST_TOKEN }),
    );

    expect(res.status).toBe(200);
  });
});

describe('PATCH /sessions/:sessionId', () => {
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

  it('corrects the receipt total and returns 200 with the updated view', async () => {
    const session = draftSession();
    mockLookup(session);
    const app = moduleWith(mock<ExtractReceipt>(async () => extracted));

    const res = await app.handle(
      request(`/sessions/${session._id}`, {
        method: 'PATCH',
        body: { totalCents: 1600 },
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ totalCents: 1600 });
  });

  it('returns 422 for a negative total', async () => {
    const session = draftSession();
    mockLookup(session);
    const app = moduleWith(mock<ExtractReceipt>(async () => extracted));

    const res = await app.handle(
      request(`/sessions/${session._id}`, {
        method: 'PATCH',
        body: { totalCents: -1 },
      }),
    );

    expect(res.status).toBe(422);
    expect(session.totalCents).toBe(600);
  });

  it('returns 403 for a guest token and keeps the total', async () => {
    const session = sessionWithGuest();
    mockLookup(session);
    const app = moduleWith(mock<ExtractReceipt>(async () => extracted));

    const res = await app.handle(
      request(`/sessions/${session._id}`, {
        method: 'PATCH',
        body: { totalCents: 1600 },
        token: GUEST_TOKEN,
      }),
    );

    expect(res.status).toBe(403);
    expect(session.totalCents).toBe(600);
  });

  it('returns 409 once the session is published', async () => {
    const session = draftSession();
    session.status = 'open';
    mockLookup(session);
    const app = moduleWith(mock<ExtractReceipt>(async () => extracted));

    const res = await app.handle(
      request(`/sessions/${session._id}`, {
        method: 'PATCH',
        body: { totalCents: 1600 },
      }),
    );

    expect(res.status).toBe(409);
    expect(await res.text()).toBe('Session is not editable');
  });
});

describe('DELETE /sessions/:sessionId', () => {
  beforeEach(() => {
    spyOn(console, 'error').mockImplementation(() => {});
    spyOn(Session.prototype, 'deleteOne').mockImplementation((async () => ({
      deletedCount: 1,
    })) as never);
  });

  afterEach(() => {
    mock.restore();
  });

  it('returns 204 with an empty body and drops the receipt image', async () => {
    const session = draftSession();
    mockLookup(session);
    const storage = fakeStorage();
    const app = moduleWith(
      mock<ExtractReceipt>(async () => extracted),
      storage,
    );

    const res = await app.handle(
      request(`/sessions/${session._id}`, { method: 'DELETE' }),
    );

    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');
    expect(Session.prototype.deleteOne).toHaveBeenCalledTimes(1);
    expect(storage.delete).toHaveBeenCalledWith('abc.jpg');
  });

  it('returns 403 for a guest token and keeps the session', async () => {
    const session = sessionWithGuest();
    mockLookup(session);
    const app = moduleWith(mock<ExtractReceipt>(async () => extracted));

    const res = await app.handle(
      request(`/sessions/${session._id}`, {
        method: 'DELETE',
        token: GUEST_TOKEN,
      }),
    );

    expect(res.status).toBe(403);
    expect(await res.text()).toBe('Forbidden');
    expect(Session.prototype.deleteOne).not.toHaveBeenCalled();
  });

  it('returns 401 without an Authorization header', async () => {
    const session = draftSession();
    mockLookup(session);
    const app = moduleWith(mock<ExtractReceipt>(async () => extracted));

    const res = await app.handle(
      request(`/sessions/${session._id}`, { method: 'DELETE', token: null }),
    );

    expect(res.status).toBe(401);
    expect(await res.text()).toBe('Unauthorized');
    expect(Session.prototype.deleteOne).not.toHaveBeenCalled();
  });

  it('returns 403 when the token belongs to another session', async () => {
    mockLookup(draftSession());
    const app = moduleWith(mock<ExtractReceipt>(async () => extracted));

    const res = await app.handle(
      request('/sessions/507f1f77bcf86cd799439011', { method: 'DELETE' }),
    );

    expect(res.status).toBe(403);
    expect(await res.text()).toBe('Forbidden');
    expect(Session.prototype.deleteOne).not.toHaveBeenCalled();
  });

  it('maps an unexpected error to 500 via onError', async () => {
    spyOn(Session, 'findOne').mockImplementation((() => {
      throw new Error('mongo down');
    }) as never);
    const app = moduleWith(mock<ExtractReceipt>(async () => extracted));

    const res = await app.handle(
      request('/sessions/507f191e810c19729de860ea', { method: 'DELETE' }),
    );

    expect(res.status).toBe(500);
    expect(await res.text()).toBe('Unexpected server error');
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
    mockLookup(session);
    const app = moduleWith(mock<ExtractReceipt>(async () => extracted));

    const res = await app.handle(
      request(`/sessions/${session._id}/line-items/${id}`, {
        method: 'DELETE',
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.lineItems).toHaveLength(0);
    expect(body.totalCents).toBe(600);
  });

  it('returns 404 when the line item is missing', async () => {
    const session = draftSession();
    mockLookup(session);
    const app = moduleWith(mock<ExtractReceipt>(async () => extracted));

    const res = await app.handle(
      request(`/sessions/${session._id}/line-items/507f1f77bcf86cd799439011`, {
        method: 'DELETE',
      }),
    );

    expect(res.status).toBe(404);
    expect(await res.text()).toBe('Line item not found');
  });

  it('returns 403 for a guest token and keeps the line', async () => {
    const session = sessionWithGuest();
    const id = String(session.lineItems[0]._id);
    mockLookup(session);
    const app = moduleWith(mock<ExtractReceipt>(async () => extracted));

    const res = await app.handle(
      request(`/sessions/${session._id}/line-items/${id}`, {
        method: 'DELETE',
        token: GUEST_TOKEN,
      }),
    );

    expect(res.status).toBe(403);
    expect(session.lineItems).toHaveLength(1);
  });
});

describe('POST /sessions/:sessionId/confirm', () => {
  beforeEach(() => {
    spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    mock.restore();
  });

  it('returns 200 with the published session and its code', async () => {
    const session = draftSession();
    mockLookup(session);
    mockPublish(session);
    const app = moduleWith(mock<ExtractReceipt>(async () => extracted));

    const res = await app.handle(
      request(`/sessions/${session._id}/confirm`, { method: 'POST' }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('open');
    expect(body.code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
  });

  it('returns 409 when a concurrent request published first', async () => {
    const session = draftSession();
    mockLookup(session);
    mockPublish(null);
    const app = moduleWith(mock<ExtractReceipt>(async () => extracted));

    const res = await app.handle(
      request(`/sessions/${session._id}/confirm`, { method: 'POST' }),
    );

    expect(res.status).toBe(409);
    expect(await res.text()).toBe('Session is not editable');
  });

  it('returns 403 for a guest token and leaves the session in draft', async () => {
    const session = sessionWithGuest();
    mockLookup(session);
    const app = moduleWith(mock<ExtractReceipt>(async () => extracted));

    const res = await app.handle(
      request(`/sessions/${session._id}/confirm`, {
        method: 'POST',
        token: GUEST_TOKEN,
      }),
    );

    expect(res.status).toBe(403);
    expect(session.status).toBe('draft');
    expect(session.code).toBeUndefined();
  });

  it('returns 401 without a token', async () => {
    const session = draftSession();
    mockLookup(session);
    const app = moduleWith(mock<ExtractReceipt>(async () => extracted));

    const res = await app.handle(
      request(`/sessions/${session._id}/confirm`, {
        method: 'POST',
        token: null,
      }),
    );

    expect(res.status).toBe(401);
    expect(session.status).toBe('draft');
  });

  it('returns 409 when the items fall short of the receipt total', async () => {
    const session = draftSession();
    session.totalCents = 1600;
    mockLookup(session);
    const app = moduleWith(mock<ExtractReceipt>(async () => extracted));

    const res = await app.handle(
      request(`/sessions/${session._id}/confirm`, { method: 'POST' }),
    );

    expect(res.status).toBe(409);
    expect(await res.text()).toBe('Items do not add up to the receipt total');
    expect(session.status).toBe('draft');
  });

  it('returns 409 when the session is already published', async () => {
    const session = draftSession();
    session.status = 'open';
    mockLookup(session);
    const app = moduleWith(mock<ExtractReceipt>(async () => extracted));

    const res = await app.handle(
      request(`/sessions/${session._id}/confirm`, { method: 'POST' }),
    );

    expect(res.status).toBe(409);
    expect(await res.text()).toBe('Session is not editable');
  });
});

describe('POST /sessions/join/:code', () => {
  beforeEach(() => {
    spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    mock.restore();
  });

  const CODE = 'ABCDEFGH';
  const joinBody = { name: 'Marta' };

  it.each([
    ['a short code', 'ABC'],
    ['a code with excluded characters', 'ABCDEFG0'],
  ])('returns 422 for %s', async (_label, code) => {
    const app = moduleWith(mock<ExtractReceipt>(async () => extracted));

    const res = await app.handle(
      request(`/sessions/join/${code}`, {
        method: 'POST',
        body: joinBody,
        token: null,
      }),
    );

    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({
      type: 'validation',
      on: 'params',
    });
  });

  it.each([
    ['an empty name', { name: '' }],
    ['a missing name', {}],
  ])('returns 422 for %s', async (_label, body) => {
    const app = moduleWith(mock<ExtractReceipt>(async () => extracted));

    const res = await app.handle(
      request(`/sessions/join/${CODE}`, { method: 'POST', body, token: null }),
    );

    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ type: 'validation', on: 'body' });
  });

  it('maps an unexpected error to 500 via onError', async () => {
    spyOn(Session, 'findOneAndUpdate').mockImplementation((() =>
      Promise.reject(new Error('mongo down'))) as never);
    const app = moduleWith(mock<ExtractReceipt>(async () => extracted));

    const res = await app.handle(
      request(`/sessions/join/${CODE}`, {
        method: 'POST',
        body: joinBody,
        token: null,
      }),
    );

    expect(res.status).toBe(500);
    expect(await res.text()).toBe('Unexpected server error');
    expect(console.error).toHaveBeenCalled();
  });
});
